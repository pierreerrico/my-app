from __future__ import annotations
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from .common import bilerp


def _velocity(u, v, x, y):
    return bilerp(u, x, y), bilerp(v, x, y)


def integrate_trajectories(
    u,
    v,
    ocean,
    seed=7,
    count=4500,
    steps=220,
    dt=.45,
    velocity_scale=8.0,
    sample_every=8,
):
    """Integrate wet-cell particle trajectories with classical RK4."""
    rng = np.random.default_rng(seed)
    ys, xs = np.where(ocean > .5)
    pick = rng.integers(0, len(xs), size=count)
    x = xs[pick].astype(np.float32) + rng.random(count)
    y = ys[pick].astype(np.float32) + rng.random(count)
    home_x = x.copy()
    home_y = y.copy()
    trails = [(x.copy(), y.copy())]

    for step in range(steps):
        k1x, k1y = _velocity(u, v, x, y)
        k2x, k2y = _velocity(
            u, v,
            x + .5 * dt * velocity_scale * k1x,
            y + .5 * dt * velocity_scale * k1y,
        )
        k3x, k3y = _velocity(
            u, v,
            x + .5 * dt * velocity_scale * k2x,
            y + .5 * dt * velocity_scale * k2y,
        )
        k4x, k4y = _velocity(
            u, v,
            x + dt * velocity_scale * k3x,
            y + dt * velocity_scale * k3y,
        )
        x2 = x + (dt * velocity_scale / 6.0) * (
            k1x + 2.0*k2x + 2.0*k3x + k4x
        )
        y2 = y + (dt * velocity_scale / 6.0) * (
            k1y + 2.0*k2y + 2.0*k3y + k4y
        )

        midpoint_wet = bilerp(ocean, .5*(x+x2), .5*(y+y2)) > .999
        endpoint_wet = bilerp(ocean, x2, y2) > .999
        inside = (
            (x2 >= 0) & (x2 < u.shape[1]-1) &
            (y2 >= 0) & (y2 < u.shape[0]-1)
        )
        valid = midpoint_wet & endpoint_wet & inside

        # Respawn invalid particles at their original wet locations. This keeps
        # the diagnostic dense without drawing segments through solid land.
        x = np.where(valid, x2, home_x)
        y = np.where(valid, y2, home_y)
        if (step + 1) % max(1, sample_every) == 0:
            trails.append((x.copy(), y.copy()))
    return trails


def add_trajectories(axis, trails, linewidth=.12, alpha=.10):
    for first, second in zip(trails[:-1], trails[1:]):
        segments = np.stack(
            [
                np.stack([first[0], first[1]], axis=-1),
                np.stack([second[0], second[1]], axis=-1),
            ],
            axis=1,
        )
        axis.add_collection(LineCollection(segments, linewidths=linewidth, alpha=alpha))


def particle_preview(
    u,
    v,
    ocean,
    land,
    path,
    seed=7,
    count=4500,
    steps=220,
    dt=.45,
    velocity_scale=8.0,
):
    trails = integrate_trajectories(
        u, v, ocean, seed, count, steps, dt, velocity_scale
    )
    figure, axis = plt.subplots(figsize=(12, 7))
    axis.imshow(np.where(land, 1, np.nan), cmap='gray', origin='upper')
    add_trajectories(axis, trails)
    axis.set_xlim(0, u.shape[1])
    axis.set_ylim(u.shape[0], 0)
    axis.set_axis_off()
    figure.tight_layout(pad=0)
    figure.savefig(path, dpi=170, bbox_inches='tight')
    plt.close(figure)
