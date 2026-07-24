from __future__ import annotations
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from .common import EPS, curl, divergence
from .particles import particle_preview, integrate_trajectories, add_trajectories


def gray_signed(a, mask):
    values = np.abs(a[mask])
    scale = max(float(np.percentile(values, 99)) if values.size else 1.0, EPS)
    return ((np.clip(a / scale, -1, 1) * .5 + .5) * 255).astype(np.uint8)


def gray_unsigned(a, mask):
    values = a[mask]
    scale = max(float(np.percentile(values, 99)) if values.size else 1.0, EPS)
    return (np.clip(a / scale, 0, 1) * 255).astype(np.uint8)


def save(result, bathy, outfile: Path, diag: Path, prefix: str, cfg: dict):
    diag.mkdir(parents=True, exist_ok=True)
    outfile.parent.mkdir(parents=True, exist_ok=True)

    u, v = result.u, result.v
    land = bathy.land
    ocean = bathy.ocean
    wet = ocean > .5
    speed = np.sqrt(u*u + v*v)
    nonzero = speed[wet & (speed > EPS)]
    scale = (
        float(np.percentile(nonzero, float(cfg.get('speedPercentile', 99))))
        if nonzero.size else 1.0
    )
    magnitude = np.clip(speed / max(scale, EPS), 0, 1) ** float(cfg.get('speedGamma', .72))
    denominator = speed + EPS

    rgba = np.stack([
        (np.where(speed > EPS, u/denominator, 0)*.5+.5)*255,
        (np.where(speed > EPS, v/denominator, 0)*.5+.5)*255,
        magnitude*255,
        result.tracer*255,
    ], axis=-1).astype(np.uint8)
    rgba[land] = [128,128,0,0]
    Image.fromarray(rgba, 'RGBA').save(outfile)

    unsigned = {
        'speed': magnitude,
        'spawn': result.tracer,
        'depth': bathy.depth,
        'wake': result.wake,
        'bathymetric-steering': result.steering,
        'eddy-force': result.eddy_force,
        'rotational-speed': np.sqrt(result.rotational_u**2 + result.rotational_v**2),
        'base-speed': np.sqrt(result.base_u**2 + result.base_v**2),
        'shear': result.shear,
        'headlands': result.geometry.headlands,
        'embayments': result.geometry.embayments,
        'constrictions': result.geometry.constrictions,
        'shelf': result.geometry.shelf,
        'shelf-break': result.geometry.shelf_break,
        'separation-potential': result.geometry.separation_potential,
    }
    for name, field in unsigned.items():
        image = (np.clip(field, 0, 1)*255).astype(np.uint8) if name in {
            'speed','spawn','depth','wake','bathymetric-steering','headlands',
            'embayments','constrictions','shelf','shelf-break','separation-potential'
        } else gray_unsigned(field, wet)
        Image.fromarray(image).save(diag/f'{prefix}-{name}.png')

    signed = {
        'vorticity': curl(u,v,ocean),
        'divergence': divergence(u,v,ocean),
        'surface': result.eta,
        'eddy-memory': result.eddy_memory,
        'coast-curvature': result.geometry.curvature,
        'streamfunction': result.streamfunction,
    }
    for name, field in signed.items():
        Image.fromarray(gray_signed(field, wet)).save(diag/f'{prefix}-{name}.png')

    yy, xx = np.mgrid[0:u.shape[0], 0:u.shape[1]]

    # Technical streamline preview.
    figure, axis = plt.subplots(figsize=(12,7))
    axis.imshow(np.where(land,1,np.nan), cmap='gray', origin='upper')
    step = max(5, u.shape[1]//65)
    axis.streamplot(
        xx[::step,::step], yy[::step,::step],
        u[::step,::step], v[::step,::step],
        density=1.55, linewidth=.55, arrowsize=.5,
    )
    axis.set_xlim(0,u.shape[1]); axis.set_ylim(u.shape[0],0); axis.set_axis_off()
    figure.tight_layout(pad=0)
    figure.savefig(diag/f'{prefix}-streamlines.png', dpi=170, bbox_inches='tight')
    plt.close(figure)

    particle_count = int(cfg.get('particleCount', 4500))
    particle_steps = int(cfg.get('particleSteps', 220))
    particle_dt = float(cfg.get('particleTimeStep', .45))
    particle_scale = float(cfg.get('particleVelocityScale', 8.0))
    trails = integrate_trajectories(
        u, v, ocean,
        count=particle_count,
        steps=particle_steps,
        dt=particle_dt,
        velocity_scale=particle_scale,
    )

    # Main preview: faint speed background, RK4 particles, sparse streamlines.
    figure, axis = plt.subplots(figsize=(12,7))
    axis.imshow(np.where(wet, magnitude, np.nan), cmap='gray', origin='upper', alpha=.20)
    axis.imshow(np.where(land,1,np.nan), cmap='gray', origin='upper')
    add_trajectories(axis, trails, linewidth=.14, alpha=.12)
    sparse = max(8, u.shape[1]//40)
    axis.streamplot(
        xx[::sparse,::sparse], yy[::sparse,::sparse],
        u[::sparse,::sparse], v[::sparse,::sparse],
        density=.55, linewidth=.45, arrowsize=.45,
    )
    axis.set_xlim(0,u.shape[1]); axis.set_ylim(u.shape[0],0); axis.set_axis_off()
    figure.tight_layout(pad=0)
    figure.savefig(diag/f'{prefix}-preview.png', dpi=170, bbox_inches='tight')
    plt.close(figure)

    particle_preview(
        u, v, ocean, land, diag/f'{prefix}-particles.png',
        count=particle_count,
        steps=particle_steps,
        dt=particle_dt,
        velocity_scale=particle_scale,
    )
