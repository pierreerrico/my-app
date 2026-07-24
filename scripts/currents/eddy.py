from __future__ import annotations
import math
import numpy as np
from .common import EPS, curl, gradient_masked, masked_blur


def shear_field(u: np.ndarray, v: np.ndarray, ocean: np.ndarray) -> np.ndarray:
    ux, uy = gradient_masked(u, ocean)
    vx, vy = gradient_masked(v, ocean)
    shear = np.sqrt((ux - vy) ** 2 + (uy + vx) ** 2) * ocean
    values = shear[ocean > .5]
    scale = max(float(np.percentile(values, 98)) if values.size else 1.0, EPS)
    return np.clip(shear / scale, 0.0, 1.0) * ocean


def component_wake_vorticity(
    u: np.ndarray,
    v: np.ndarray,
    geometry,
    ocean: np.ndarray,
    cfg: dict,
) -> tuple[np.ndarray, np.ndarray]:
    """Build flow-dependent wake density and signed vorticity per obstacle.

    Each connected land component is treated as an obstacle. The local mean
    flow around it defines a downstream axis. A tapered wake tube is placed
    behind the obstacle and split into counter-rotating lobes. Boundary-touching
    continents are retained but weakened so islands dominate local roll-up.
    """
    h, w = ocean.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    wake = np.zeros((h, w), np.float32)
    omega = np.zeros_like(wake)

    length_factor = float(cfg.get('componentWakeLengthFactor', 8.0))
    width_factor = float(cfg.get('componentWakeWidthFactor', 1.35))
    min_speed = float(cfg.get('componentWakeMinimumSpeed', 0.01))
    strength = float(cfg.get('componentWakeVorticity', 0.065))
    continent_scale = float(cfg.get('componentWakeBoundaryScale', 0.35))
    max_radius = float(cfg.get('componentWakeMaximumRadius', 70.0))

    for obstacle in geometry.obstacles:
        ring = obstacle.near_ocean
        if not np.any(ring):
            continue
        mean_u = float(np.mean(u[ring]))
        mean_v = float(np.mean(v[ring]))
        speed = math.hypot(mean_u, mean_v)
        if speed < min_speed:
            continue
        fx = mean_u / speed
        fy = mean_v / speed
        cx, cy = obstacle.center_x, obstacle.center_y
        radius = min(obstacle.radius, max_radius)
        rx = xx - cx
        ry = yy - cy
        downstream = rx * fx + ry * fy
        lateral = -rx * fy + ry * fx

        wake_length = max(radius * length_factor, 8.0)
        wake_width = max(radius * width_factor, 3.0)
        downstream_mask = np.clip(downstream / wake_length, 0.0, 1.0)
        tube = np.exp(-0.5 * (lateral / wake_width) ** 2)
        start = 1.0 - np.exp(-np.maximum(downstream, 0.0) / max(radius, 1.0))
        decay = np.exp(-np.maximum(downstream, 0.0) / wake_length)
        envelope = tube * start * decay * (downstream > 0.0)
        envelope *= np.clip(speed * float(cfg.get('wakeSpeedScale', 5.5)), 0.0, 1.0)
        if obstacle.touches_boundary:
            envelope *= continent_scale
        envelope *= ocean

        # Counter-rotating lobes across the wake centreline. A downstream phase
        # introduces a restrained von-Karman-like alternation without randomness.
        lobe_sign = np.tanh(lateral / max(wake_width * .32, EPS))
        wavelength = max(radius * float(cfg.get('componentWakeWavelengthFactor', 4.5)), 6.0)
        phase = np.sin(2.0 * np.pi * downstream / wavelength)
        signed = lobe_sign * (0.65 + 0.35 * phase)

        wake = np.maximum(wake, envelope)
        omega += strength * envelope * signed

    return np.clip(wake, 0.0, 1.0) * ocean, np.clip(omega, -1.0, 1.0) * ocean


def flow_separation_source(
    u: np.ndarray,
    v: np.ndarray,
    geometry,
    ocean: np.ndarray,
    strength: float,
) -> np.ndarray:
    """Signed separation source depending on actual flow direction."""
    speed = np.sqrt(u*u + v*v)
    fx = u / (speed + EPS)
    fy = v / (speed + EPS)
    # Coast curvature becomes active only where the flow has a strong tangential
    # component and is leaving a geometrically exposed feature.
    coast_normal_x, coast_normal_y = gradient_masked(geometry.coast_band, ocean)
    n = np.sqrt(coast_normal_x**2 + coast_normal_y**2) + EPS
    nx, ny = coast_normal_x/n, coast_normal_y/n
    tangent_alignment = np.abs(fx * (-ny) + fy * nx)
    leaving = np.clip(-(fx*nx + fy*ny), 0.0, 1.0)
    sign = np.sign(geometry.curvature + EPS)
    envelope = geometry.separation_potential * tangent_alignment * (0.4 + 0.6*leaving)
    return strength * sign * envelope * np.clip(speed*4.0, 0.0, 1.0) * ocean


def update_vorticity_memory(
    memory: np.ndarray,
    component_source: np.ndarray,
    separation_source: np.ndarray,
    physical_omega: np.ndarray,
    shear: np.ndarray,
    wake: np.ndarray,
    ocean: np.ndarray,
    decay: float,
    injection: float,
    diffusion: float,
) -> np.ndarray:
    source = component_source + separation_source
    source += injection * np.tanh(physical_omega * 7.0) * np.clip(.55*wake + .45*shear, 0.0, 1.0)
    memory = decay * memory + source
    if diffusion > 0.0:
        memory = (1.0-diffusion)*memory + diffusion*masked_blur(memory, ocean)
    return np.clip(memory, -1.0, 1.0) * ocean


def reconstruct_rotational_velocity(
    omega: np.ndarray,
    ocean: np.ndarray,
    iterations: int,
    velocity_strength: float,
    maximum_speed: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Recover a divergence-free rotational velocity from vorticity.

    Solves ∇²ψ = -ω with dry cells and outer edges fixed at ψ=0, then uses
    u_rot = ∂ψ/∂y and v_rot = -∂ψ/∂x. This keeps wake/eddy dynamics in the
    vorticity scale until the final velocity reconstruction stage.
    """
    psi = np.zeros_like(omega, dtype=np.float32)
    wet = ocean > .5
    for _ in range(max(1, iterations)):
        p = np.pad(psi, 1, mode='constant', constant_values=0.0)
        psi_new = .25 * (
            p[1:-1, 2:] + p[1:-1, :-2]
            + p[2:, 1:-1] + p[:-2, 1:-1]
            + omega
        )
        psi = np.where(wet, psi_new, 0.0).astype(np.float32)
        psi[0, :] = 0.0; psi[-1, :] = 0.0
        psi[:, 0] = 0.0; psi[:, -1] = 0.0

    dpsi_dx, dpsi_dy = gradient_masked(psi, ocean)
    rot_u = dpsi_dy * velocity_strength
    rot_v = -dpsi_dx * velocity_strength
    speed = np.sqrt(rot_u*rot_u + rot_v*rot_v)
    limiter = np.minimum(1.0, maximum_speed / (speed + EPS))
    rot_u *= limiter * ocean
    rot_v *= limiter * ocean
    return rot_u, rot_v, psi
