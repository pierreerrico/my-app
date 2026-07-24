from __future__ import annotations
import math
from pathlib import Path
import numpy as np

EPS = 1e-8


def smoothstep(a: float, b: float, x):
    t = np.clip((x-a) / max(b-a, EPS), 0.0, 1.0)
    return t*t*(3.0-2.0*t)


def bilerp(field: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    h, w = field.shape
    x = np.clip(x, 0.0, w - 1.001)
    y = np.clip(y, 0.0, h - 1.001)
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    tx = x - x0; ty = y - y0
    return ((1-tx)*(1-ty)*field[y0,x0] + tx*(1-ty)*field[y0,x1]
            + (1-tx)*ty*field[y1,x0] + tx*ty*field[y1,x1])


def masked_blur(field: np.ndarray, ocean: np.ndarray, passes: int = 1) -> np.ndarray:
    out = field.astype(np.float32, copy=True) * ocean
    wet = ocean.astype(np.float32)
    for _ in range(max(0, passes)):
        f = np.pad(out, 1, mode='edge'); m = np.pad(wet, 1, mode='edge')
        weighted = (4*f[1:-1,1:-1]*m[1:-1,1:-1] + f[:-2,1:-1]*m[:-2,1:-1]
                    + f[2:,1:-1]*m[2:,1:-1] + f[1:-1,:-2]*m[1:-1,:-2]
                    + f[1:-1,2:]*m[1:-1,2:])
        weights = (4*m[1:-1,1:-1] + m[:-2,1:-1] + m[2:,1:-1]
                   + m[1:-1,:-2] + m[1:-1,2:])
        out = np.where(wet > .5, weighted / np.maximum(weights, 1.0), 0.0)
    return out.astype(np.float32)


def gradient_masked(field: np.ndarray, ocean: np.ndarray):
    p = np.pad(field, 1, mode='edge'); m = np.pad(ocean, 1, mode='edge')
    c = p[1:-1,1:-1]
    r = np.where(m[1:-1,2:] > .5, p[1:-1,2:], c)
    l = np.where(m[1:-1,:-2] > .5, p[1:-1,:-2], c)
    d = np.where(m[2:,1:-1] > .5, p[2:,1:-1], c)
    u = np.where(m[:-2,1:-1] > .5, p[:-2,1:-1], c)
    return .5*(r-l)*ocean, .5*(d-u)*ocean


def curl(u: np.ndarray, v: np.ndarray, ocean: np.ndarray) -> np.ndarray:
    dv_dx, _ = gradient_masked(v, ocean)
    _, du_dy = gradient_masked(u, ocean)
    return (dv_dx - du_dy) * ocean


def divergence(u: np.ndarray, v: np.ndarray, ocean: np.ndarray) -> np.ndarray:
    du_dx, _ = gradient_masked(u, ocean)
    _, dv_dy = gradient_masked(v, ocean)
    return (du_dx + dv_dy) * ocean
