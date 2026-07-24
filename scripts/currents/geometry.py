from __future__ import annotations
from dataclasses import dataclass
import math
import numpy as np
from scipy import ndimage
from .common import EPS, masked_blur


@dataclass(frozen=True)
class Obstacle:
    label: int
    area: int
    center_x: float
    center_y: float
    radius: float
    touches_boundary: bool
    mask: np.ndarray
    near_ocean: np.ndarray


@dataclass
class GeometryAnalysis:
    coast_distance: np.ndarray
    coast_band: np.ndarray
    curvature: np.ndarray
    headlands: np.ndarray
    embayments: np.ndarray
    constrictions: np.ndarray
    shelf: np.ndarray
    shelf_break: np.ndarray
    obstacle_scale: np.ndarray
    separation_potential: np.ndarray
    obstacle_labels: np.ndarray
    obstacles: list[Obstacle]


def _distance_from_land(land: np.ndarray, ocean: np.ndarray, iterations: int) -> np.ndarray:
    distance = np.full(land.shape, float(iterations), np.float32)
    distance[land] = 0.0
    frontier = land.copy()
    reached = land.copy()
    for step in range(1, max(1, iterations) + 1):
        p = np.pad(frontier, 1, mode='constant', constant_values=False)
        expanded = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        new = expanded & (~reached)
        distance[new] = float(step)
        reached |= new
        frontier = new
        if not np.any(frontier):
            break
    return distance * ocean


def _connected_obstacles(land: np.ndarray, ocean: np.ndarray, cfg: dict) -> tuple[np.ndarray, list[Obstacle]]:
    structure = np.ones((3, 3), dtype=np.uint8)
    labels, count = ndimage.label(land, structure=structure)
    min_area = int(cfg.get('geometryMinimumObstacleArea', 6))
    ring_cells = int(cfg.get('geometryObstacleRingCells', 5))
    obstacles: list[Obstacle] = []
    h, w = land.shape

    for label_id in range(1, count + 1):
        mask = labels == label_id
        area = int(mask.sum())
        if area < min_area:
            labels[mask] = 0
            continue
        ys, xs = np.where(mask)
        center_x = float(xs.mean())
        center_y = float(ys.mean())
        # Equivalent radius gives a stable wake scale even for irregular islands.
        radius = max(math.sqrt(area / math.pi), 1.5)
        touches = bool(
            np.any(xs == 0) or np.any(xs == w - 1)
            or np.any(ys == 0) or np.any(ys == h - 1)
        )
        dilated = ndimage.binary_dilation(mask, iterations=max(1, ring_cells))
        near_ocean = dilated & (~mask) & (ocean > .5)
        obstacles.append(Obstacle(
            label=label_id,
            area=area,
            center_x=center_x,
            center_y=center_y,
            radius=radius,
            touches_boundary=touches,
            mask=mask,
            near_ocean=near_ocean,
        ))

    return labels.astype(np.int32), obstacles


def analyse(bathy, cfg: dict) -> GeometryAnalysis:
    ocean = bathy.ocean
    land = bathy.land
    max_distance = int(cfg.get('geometryDistanceCells', 36))
    coast_distance = _distance_from_land(land, ocean, max_distance)
    coast_band_cells = float(cfg.get('geometryCoastBandCells', 12.0))
    coast_band = np.clip(1.0 - coast_distance / max(coast_band_cells, EPS), 0.0, 1.0) * ocean

    signed = masked_blur(ocean, np.ones_like(ocean), int(cfg.get('geometrySmoothingPasses', 3)))
    gy, gx = np.gradient(signed)
    norm = np.sqrt(gx * gx + gy * gy) + EPS
    nx, ny = gx / norm, gy / norm
    curvature = (np.gradient(nx, axis=1) + np.gradient(ny, axis=0)) * coast_band
    wet_values = np.abs(curvature[ocean > .5])
    curv_scale = max(float(np.percentile(wet_values, 98)) if wet_values.size else 1.0, EPS)
    curvature = np.clip(curvature / curv_scale, -1.0, 1.0) * ocean
    headlands = np.clip(curvature, 0.0, 1.0) * coast_band
    embayments = np.clip(-curvature, 0.0, 1.0) * coast_band

    broad = masked_blur(ocean, np.ones_like(ocean), int(cfg.get('geometryConstrictionPasses', 8)))
    constrictions = np.clip((1.0 - broad) * 2.4, 0.0, 1.0) * ocean
    constrictions *= np.clip(coast_band * 1.5, 0.0, 1.0)

    depth = bathy.depth
    shelf_min = float(cfg.get('geometryShelfDepthMin', 0.03))
    shelf_max = float(cfg.get('geometryShelfDepthMax', 0.34))
    shelf = np.clip((shelf_max - depth) / max(shelf_max - shelf_min, EPS), 0.0, 1.0) * ocean
    slope = np.sqrt(bathy.slope_x ** 2 + bathy.slope_y ** 2)
    slope_values = slope[ocean > .5]
    slope_scale = max(float(np.percentile(slope_values, 97)) if slope_values.size else 1.0, EPS)
    shelf_break = np.clip(slope / slope_scale, 0.0, 1.0) * ocean

    land_float = land.astype(np.float32)
    obstacle_scale = land_float.copy()
    for _ in range(int(cfg.get('geometryObstacleSmoothingPasses', 10))):
        p = np.pad(obstacle_scale, 1, mode='edge')
        obstacle_scale = (
            p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2]
            + p[1:-1, 2:] + 4.0 * p[1:-1, 1:-1]
        ) / 8.0
    obstacle_scale = np.clip(obstacle_scale * 2.2, 0.0, 1.0) * ocean

    separation_potential = np.clip(
        0.55 * headlands + 0.25 * constrictions + 0.20 * shelf_break,
        0.0,
        1.0,
    ) * ocean

    labels, obstacles = _connected_obstacles(land, ocean, cfg)

    return GeometryAnalysis(
        coast_distance=coast_distance,
        coast_band=coast_band,
        curvature=curvature,
        headlands=headlands,
        embayments=embayments,
        constrictions=constrictions,
        shelf=shelf,
        shelf_break=shelf_break,
        obstacle_scale=obstacle_scale,
        separation_potential=separation_potential,
        obstacle_labels=labels,
        obstacles=obstacles,
    )
