from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .common import masked_blur, gradient_masked, divergence, smoothstep, curl
from .atmosphere import dominant_wind
from .boundaries import build_inflows, impose_inflow, open_boundaries
from .geometry import analyse as analyse_geometry
from .eddy import (
    shear_field,
    component_wake_vorticity,
    flow_separation_source,
    update_vorticity_memory,
    reconstruct_rotational_velocity,
)
from .numerics import advect, advect_maccormack, coast_project, bathymetric_steering


@dataclass
class Result:
    u: np.ndarray
    v: np.ndarray
    base_u: np.ndarray
    base_v: np.ndarray
    rotational_u: np.ndarray
    rotational_v: np.ndarray
    streamfunction: np.ndarray
    eta: np.ndarray
    tracer: np.ndarray
    wind_u: np.ndarray
    wind_v: np.ndarray
    wake: np.ndarray
    steering: np.ndarray
    eddy_memory: np.ndarray
    eddy_force: np.ndarray
    shear: np.ndarray
    geometry: object


class HybridOceanModel:
    """Scale-separated regional ocean-current generator.

    1. A shallow-water-inspired base model produces the large-scale transport.
    2. Bathymetric steering modifies depth-integrated transport.
    3. Connected obstacles generate wake vorticity, never direct velocity.
    4. Vorticity memory is advected and reconstructed into a divergence-free
       rotational velocity through a streamfunction Poisson solve.
    5. Base and rotational velocities are combined only for final transport,
       diagnostics and particles.
    """

    def __init__(self, source, cfg, bathy, width, height):
        self.source = source
        self.cfg = cfg
        self.bathy = bathy
        self.w = width
        self.h = height
        self.ocean = bathy.ocean
        self.yy, self.xx = np.mgrid[0:height, 0:width].astype(np.float32)
        self.geometry = analyse_geometry(bathy, cfg)

        atmosphere = source['ocean'].get('atmosphere', {})
        if atmosphere.get('enabled', True):
            self.wx, self.wy, self.lat = dominant_wind(source, width, height, atmosphere)
        else:
            zero = np.zeros((height, width), np.float32)
            self.wx, self.wy, self.lat = zero.copy(), zero.copy(), zero.copy()
        self.wx *= self.ocean
        self.wy *= self.ocean

        self.imask, self.iu, self.iv, self.tsource = build_inflows(
            width, height, list(source['ocean'].get('currents', [])), self.ocean
        )

    def _advect(self, field, u, v, dt, use_maccormack=True):
        fn = advect_maccormack if use_maccormack else advect
        return fn(
            field, u, v, self.ocean, self.xx, self.yy, dt,
            float(self.cfg.get('advectionScaleCells', 10.0)),
            float(self.cfg.get('maxAdvectionCells', 1.5)),
            int(self.cfg.get('collisionSubsteps', 4)),
        )

    def run(self, iterations_override=None):
        cfg = self.cfg
        dt = float(cfg.get('timeStep', .16))
        hydro_iterations = int(iterations_override or cfg.get('hydrodynamicSpinupIterations', 1800))

        base_u = np.zeros((self.h, self.w), np.float32)
        base_v = np.zeros_like(base_u)
        rot_u = np.zeros_like(base_u)
        rot_v = np.zeros_like(base_u)
        streamfunction = np.zeros_like(base_u)
        eta = np.zeros_like(base_u)
        tracer = np.zeros_like(base_u)
        wake = np.zeros_like(base_u)
        eddy_memory = np.zeros_like(base_u)
        steering_field = np.zeros_like(base_u)
        shear = np.zeros_like(base_u)

        minimum_depth = float(cfg.get('minimumTotalDepth', .02))
        maximum_eta = float(cfg.get('maximumSurfaceDisplacement', .15))
        ramp_iterations = int(cfg.get('inflowRampIterations', 200))
        check_interval = int(cfg.get('convergenceCheckInterval', 50))
        minimum_iterations = int(cfg.get('minimumSpinupIterations', 700))
        tolerance = float(cfg.get('convergenceTolerance', .0015))
        previous_u = base_u.copy(); previous_v = base_v.copy()
        use_maccormack = bool(cfg.get('useMacCormack', True))

        memory_decay = float(cfg.get('eddyMemoryDecay', .996))
        memory_injection = float(cfg.get('eddyMemoryInjection', .035))
        memory_diffusion = float(cfg.get('eddyMemoryDiffusion', .01))
        reconstruction_interval = int(cfg.get('vorticityReconstructionInterval', 10))
        poisson_iterations = int(cfg.get('streamfunctionIterations', 70))
        rotational_strength = float(cfg.get('rotationalVelocityStrength', .32))
        rotational_max = float(cfg.get('rotationalMaximumSpeed', .22))
        component_update_interval = int(cfg.get('componentWakeUpdateInterval', 8))
        component_source = np.zeros_like(base_u)
        separation_source = np.zeros_like(base_u)

        for iteration in range(hydro_iterations):
            old_u = base_u.copy(); old_v = base_v.copy()
            base_u = self._advect(old_u, old_u, old_v, dt, use_maccormack)
            base_v = self._advect(old_v, old_u, old_v, dt, use_maccormack)

            viscosity = float(cfg.get('viscosity', .006))
            if viscosity:
                base_u = (1.0-viscosity)*base_u + viscosity*masked_blur(base_u, self.ocean)
                base_v = (1.0-viscosity)*base_v + viscosity*masked_blur(base_v, self.ocean)

            total_depth = np.maximum(self.bathy.depth + eta, minimum_depth) * self.ocean
            eta -= dt * divergence(base_u*total_depth, base_v*total_depth, self.ocean)
            surface_diffusion = float(cfg.get('surfaceDiffusion', .012))
            if surface_diffusion:
                eta = (1.0-surface_diffusion)*eta + surface_diffusion*masked_blur(eta, self.ocean)
            eta = np.clip(eta, -maximum_eta, maximum_eta) * self.ocean

            eta_x, eta_y = gradient_masked(eta, self.ocean)
            gravity = float(cfg.get('gravity', .32))
            base_u -= dt * gravity * eta_x
            base_v -= dt * gravity * eta_y

            inverse_depth = self.ocean / np.maximum(self.bathy.depth, minimum_depth)
            wind_coupling = float(cfg.get('windCoupling', .0025))
            base_u += dt * wind_coupling * self.wx * inverse_depth
            base_v += dt * wind_coupling * self.wy * inverse_depth

            coriolis = float(cfg.get('coriolisStrength', .022)) * np.sin(np.radians(self.lat))
            new_u = base_u + dt*coriolis*base_v
            new_v = base_v - dt*coriolis*base_u
            base_u, base_v = new_u, new_v

            base_u, base_v, steering_field = bathymetric_steering(
                base_u, base_v, self.bathy,
                float(cfg.get('bathymetricSteering', .18)),
                float(cfg.get('bathymetricSlopeStart', .003)),
                float(cfg.get('bathymetricSlopeFull', .035)),
                float(cfg.get('bathymetricMaximumBlend', .65)),
            )

            speed = np.sqrt(base_u*base_u + base_v*base_v)
            drag = float(cfg.get('bottomDrag', .0012))*speed/np.maximum(self.bathy.depth, minimum_depth)
            damping = np.clip(1.0-float(cfg.get('velocityDecay', .00025))-dt*drag, 0.0, 1.0)
            base_u *= damping*self.ocean; base_v *= damping*self.ocean
            base_u, base_v = coast_project(base_u, base_v, self.bathy, float(cfg.get('coastSlip', .99)))

            ramp = float(smoothstep(0.0, float(max(ramp_iterations, 1)), np.asarray(float(iteration+1))))
            base_u, base_v = impose_inflow(
                base_u, base_v, self.imask, self.iu, self.iv,
                float(cfg.get('inflowRelaxation', .55))*ramp,
            )
            base_u, base_v, eta, tracer = open_boundaries(base_u, base_v, eta, tracer, self.imask)
            base_u *= self.ocean; base_v *= self.ocean

            # Wake/eddy scale: all sources remain vorticity until reconstruction.
            eddy_memory = self._advect(eddy_memory, base_u, base_v, dt, False)
            if iteration % max(1, component_update_interval) == 0:
                wake, component_source = component_wake_vorticity(
                    base_u, base_v, self.geometry, self.ocean, cfg
                )
                separation_source = flow_separation_source(
                    base_u, base_v, self.geometry, self.ocean,
                    float(cfg.get('flowSeparationVorticity', .018)),
                )
            shear = shear_field(base_u, base_v, self.ocean)
            physical_omega = curl(base_u, base_v, self.ocean)
            eddy_memory = update_vorticity_memory(
                eddy_memory, component_source, separation_source,
                physical_omega, shear, wake, self.ocean,
                memory_decay, memory_injection, memory_diffusion,
            )

            if iteration % max(1, reconstruction_interval) == 0 or iteration == hydro_iterations-1:
                rot_u, rot_v, streamfunction = reconstruct_rotational_velocity(
                    eddy_memory, self.ocean, poisson_iterations,
                    rotational_strength, rotational_max,
                )
                rot_u, rot_v = coast_project(rot_u, rot_v, self.bathy, 1.0)

            if (iteration+1) % check_interval == 0:
                wet = self.ocean > .5
                difference = np.sqrt(np.mean((base_u[wet]-previous_u[wet])**2 + (base_v[wet]-previous_v[wet])**2))
                reference = np.sqrt(np.mean(previous_u[wet]**2 + previous_v[wet]**2))
                relative = float(difference/max(reference, 1e-5))
                previous_u = base_u.copy(); previous_v = base_v.copy()
                print(
                    f'hydro {iteration+1}/{hydro_iterations} '
                    f'| relative change {relative:.6f} '
                    f'| base max {float(np.sqrt(base_u*base_u+base_v*base_v).max()):.4f} '
                    f'| rotational max {float(np.sqrt(rot_u*rot_u+rot_v*rot_v).max()):.4f}'
                )
                if iteration+1 >= minimum_iterations and relative <= tolerance:
                    print(f'converged after {iteration+1} iterations')
                    break

        final_u = (base_u + rot_u) * self.ocean
        final_v = (base_v + rot_v) * self.ocean
        final_u, final_v = coast_project(final_u, final_v, self.bathy, float(cfg.get('coastSlip', .99)))

        for _ in range(int(cfg.get('tracerSpinupIterations', 1100))):
            tracer = self._advect(tracer, final_u, final_v, dt, use_maccormack)
            tracer_diffusion = float(cfg.get('tracerDiffusion', .003))
            if tracer_diffusion:
                tracer = (1.0-tracer_diffusion)*tracer + tracer_diffusion*masked_blur(tracer, self.ocean)
            tracer = np.maximum(tracer, self.tsource*float(cfg.get('tracerSourceRelaxation', .8))) * self.ocean
            _, _, _, tracer = open_boundaries(final_u, final_v, eta, tracer, self.imask)

        return Result(
            u=final_u, v=final_v,
            base_u=base_u*self.ocean, base_v=base_v*self.ocean,
            rotational_u=rot_u*self.ocean, rotational_v=rot_v*self.ocean,
            streamfunction=streamfunction*self.ocean,
            eta=eta*self.ocean, tracer=np.clip(tracer, 0.0, 1.0),
            wind_u=self.wx, wind_v=self.wy,
            wake=np.clip(wake, 0.0, 1.0),
            steering=np.clip(steering_field, 0.0, 1.0),
            eddy_memory=np.clip(eddy_memory, -1.0, 1.0),
            eddy_force=np.sqrt(rot_u*rot_u + rot_v*rot_v)*self.ocean,
            shear=shear,
            geometry=self.geometry,
        )
