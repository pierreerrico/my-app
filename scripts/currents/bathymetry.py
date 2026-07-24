from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from PIL import Image
from .common import EPS, masked_blur, gradient_masked

@dataclass
class Bathymetry:
    depth: np.ndarray
    depth_km: np.ndarray
    ocean: np.ndarray
    land: np.ndarray
    slope_x: np.ndarray
    slope_y: np.ndarray
    coast_influence: np.ndarray
    coast_normal_x: np.ndarray
    coast_normal_y: np.ndarray


def load(path: Path, width: int, height: int, cfg: dict, coast_cells: int) -> Bathymetry:
    image = Image.open(path).convert('L').resize((width,height), Image.Resampling.LANCZOS)
    gray = np.asarray(image, dtype=np.float32) / 255.0
    threshold = float(cfg.get('landThreshold', .999))
    max_depth = float(cfg.get('maximumDepthKm', 6.0))
    min_wet = float(cfg.get('minimumWetDepthKm', .02))
    land = gray >= threshold
    ocean = (~land).astype(np.float32)
    depth = np.clip(1.0-gray, 0.0, 1.0) * ocean
    depth = np.where(ocean>.5, np.maximum(depth, min_wet/max(max_depth,EPS)), 0.0).astype(np.float32)
    depth_km = depth * max_depth
    slope_x, slope_y = gradient_masked(depth, ocean)
    # A broad coast field is used only for normals and wake detection.
    soft_land = land.astype(np.float32)
    for _ in range(max(1, coast_cells)):
        p=np.pad(soft_land,1,mode='edge')
        soft_land=(p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:]+4*p[1:-1,1:-1])/8.0
    gy,gx=np.gradient(soft_land); n=np.sqrt(gx*gx+gy*gy)+EPS
    influence=np.clip(soft_land*4.0,0,1)*ocean
    return Bathymetry(depth, depth_km, ocean, land, slope_x, slope_y,
                      influence, gx/n, gy/n)
