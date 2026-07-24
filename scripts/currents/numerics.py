from __future__ import annotations
import numpy as np
from .common import EPS, bilerp, gradient_masked, curl


def advect(field, u, v, ocean, xx, yy, dt, scale, max_cells, substeps):
    """Land-aware first-order semi-Lagrangian advection."""
    dx = np.clip(dt * u * scale, -max_cells, max_cells)
    dy = np.clip(dt * v * scale, -max_cells, max_cells)
    valid = ocean > .5

    for k in range(1, max(1, substeps) + 1):
        fraction = k / max(1, substeps)
        valid &= bilerp(ocean, xx - dx * fraction, yy - dy * fraction) > .999

    sx = xx - dx
    sy = yy - dy
    sampled = bilerp(field, sx, sy)

    # Require the complete interpolation footprint to be wet. This prevents
    # values from jumping across thin islands and diagonal coastlines.
    x0 = np.floor(np.clip(sx, 0, field.shape[1] - 1.001)).astype(np.int32)
    y0 = np.floor(np.clip(sy, 0, field.shape[0] - 1.001)).astype(np.int32)
    x1 = np.minimum(x0 + 1, field.shape[1] - 1)
    y1 = np.minimum(y0 + 1, field.shape[0] - 1)
    valid &= (
        (ocean[y0, x0] > .5)
        & (ocean[y0, x1] > .5)
        & (ocean[y1, x0] > .5)
        & (ocean[y1, x1] > .5)
    )
    return np.where(valid, sampled, field) * ocean


def _local_extrema(field: np.ndarray, ocean: np.ndarray):
    """Five-point wet-neighbour extrema used by the MacCormack limiter."""
    f = np.pad(field, 1, mode='edge')
    m = np.pad(ocean, 1, mode='edge')
    center = f[1:-1, 1:-1]
    candidates = [center]
    for values, wet in (
        (f[:-2, 1:-1], m[:-2, 1:-1]),
        (f[2:, 1:-1], m[2:, 1:-1]),
        (f[1:-1, :-2], m[1:-1, :-2]),
        (f[1:-1, 2:], m[1:-1, 2:]),
    ):
        candidates.append(np.where(wet > .5, values, center))
    stack = np.stack(candidates, axis=0)
    return np.min(stack, axis=0), np.max(stack, axis=0)


def advect_maccormack(field, u, v, ocean, xx, yy, dt, scale, max_cells, substeps):
    """Second-order MacCormack advection with a monotonic wet-cell limiter.

    A forward semi-Lagrangian pass is followed by a reverse pass. The error
    correction preserves substantially more shear and vorticity than the
    first-order scheme, while local clamping prevents ringing and overshoot.
    """
    forward = advect(
        field, u, v, ocean, xx, yy, dt, scale, max_cells, substeps
    )
    reverse = advect(
        forward, u, v, ocean, xx, yy, -dt, scale, max_cells, substeps
    )
    corrected = forward + 0.5 * (field - reverse)
    local_min, local_max = _local_extrema(field, ocean)
    corrected = np.clip(corrected, local_min, local_max)
    return corrected * ocean


def coast_project(u, v, bathy, slip):
    normal = u * bathy.coast_normal_x + v * bathy.coast_normal_y
    u -= bathy.coast_influence * normal * bathy.coast_normal_x
    v -= bathy.coast_influence * normal * bathy.coast_normal_y
    keep = 1 - (1 - slip) * bathy.coast_influence
    return u * keep * bathy.ocean, v * keep * bathy.ocean


def vorticity_confinement_force(u, v, ocean, strength):
    """Return a restrained force that restores numerically lost rotation."""
    if strength <= 0:
        return np.zeros_like(u), np.zeros_like(v)
    omega = curl(u, v, ocean)
    gx, gy = gradient_masked(np.abs(omega), ocean)
    norm = np.sqrt(gx * gx + gy * gy) + EPS
    nx = gx / norm
    ny = gy / norm
    # N × omega in image-grid coordinates.
    return (
        strength * ny * omega * ocean,
        -strength * nx * omega * ocean,
    )


def bathymetric_steering(
    u,
    v,
    bathy,
    strength,
    slope_start=0.003,
    slope_full=0.035,
    maximum_blend=0.65,
):
    """Steer depth-integrated transport along isobaths.

    Steering the transport H*U rather than U itself is more consistent with a
    depth-averaged model. Flat seabed is ignored; only significant slopes are
    allowed to rotate the transport.
    """
    if strength <= 0:
        return u, v, np.zeros_like(u)

    gx = bathy.slope_x
    gy = bathy.slope_y
    slope_norm = np.sqrt(gx * gx + gy * gy)
    tx = -gy / (slope_norm + EPS)
    ty = gx / (slope_norm + EPS)

    depth = np.maximum(bathy.depth, EPS)
    transport_u = u * depth
    transport_v = v * depth
    tangential = transport_u * tx + transport_v * ty
    steered_u = tangential * tx
    steered_v = tangential * ty

    slope_weight = np.clip(
        (slope_norm - slope_start) / max(slope_full - slope_start, EPS),
        0.0,
        1.0,
    ) * bathy.ocean
    blend = np.clip(strength * slope_weight, 0.0, maximum_blend)

    mixed_transport_u = transport_u * (1.0 - blend) + steered_u * blend
    mixed_transport_v = transport_v * (1.0 - blend) + steered_v * blend
    out_u = mixed_transport_u / depth
    out_v = mixed_transport_v / depth
    return out_u * bathy.ocean, out_v * bathy.ocean, blend


def wake_source(u, v, bathy, speed_scale):
    """Detect lee-side coastal cells that seed persistent obstacle wakes."""
    speed = np.sqrt(u * u + v * v)
    nx = bathy.coast_normal_x
    ny = bathy.coast_normal_y
    alignment = np.clip(-(u * nx + v * ny) / (speed + EPS), 0.0, 1.0)
    return (
        bathy.coast_influence
        * alignment
        * np.clip(speed * speed_scale, 0.0, 1.0)
        * bathy.ocean
    )


def wake_pair_force(
    u,
    v,
    wake,
    ocean,
    strength,
    pair_gain=8.0,
):
    """Generate a counter-rotating perturbation across an advected wake.

    The transverse derivative of the wake changes sign across its centreline.
    This produces opposite rotational forcing on the two sides instead of a
    single arbitrary spin tied directly to coastline curvature.
    """
    if strength <= 0:
        return np.zeros_like(u), np.zeros_like(v)

    speed = np.sqrt(u * u + v * v)
    flow_x = u / (speed + EPS)
    flow_y = v / (speed + EPS)
    cross_x = -flow_y
    cross_y = flow_x

    gx, gy = gradient_masked(wake, ocean)
    transverse = gx * cross_x + gy * cross_y
    spin = np.tanh(transverse * pair_gain)

    envelope = wake * np.clip(speed * 4.0, 0.0, 1.0)
    # Opposite lateral accelerations on either side of the wake centreline.
    fx = cross_x * spin * envelope * strength
    fy = cross_y * spin * envelope * strength
    return fx * ocean, fy * ocean
