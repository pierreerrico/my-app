#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, distance_transform_edt


def load_gray(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert("L"), dtype=np.uint8)


def report(name: str, values: np.ndarray) -> None:
    unique = np.unique(values)
    print(
        f"{name:28} {values.shape[1]}x{values.shape[0]} "
        f"min={values.min():3d} max={values.max():3d} "
        f"unique={len(unique):4d}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Controlla coerenza e raccordi delle mask di Selodia.",
    )
    parser.add_argument(
        "directory",
        type=Path,
        nargs="?",
        default=Path("public/maps/selodia"),
    )
    parser.add_argument("--sea-level", type=int, default=9)
    arguments = parser.parse_args()
    root = arguments.directory

    paths = {
        "land": root / "selodia-land-mask.png",
        "height": root / "selodia-heightmap.png",
        "terrain": root / "selodia-terrain-heightmap.png",
        "river": root / "selodia-rivers-generated.png",
        "coast": root / "selodia-coast-distance.png",
        "bathymetry": root / "selodia-bathymetry.png",
    }
    rasters = {name: load_gray(path) for name, path in paths.items()}

    for name, values in rasters.items():
        report(name, values)

    shapes = {values.shape for values in rasters.values()}
    if len(shapes) != 1:
        raise SystemExit(f"ERRORE: dimensioni incompatibili: {shapes}")

    land = rasters["land"] >= 128
    source_land = rasters["height"] > arguments.sea_level
    terrain_land = rasters["terrain"] > arguments.sea_level
    print()
    print(f"land/source mismatch:  {np.count_nonzero(land ^ source_land):,}")
    print(f"land/terrain mismatch: {np.count_nonzero(land ^ terrain_land):,}")

    river = rasters["river"]
    print(f"river ink at sea:      {np.count_nonzero((river > 0) & ~land):,}")
    print(
        "river land baseline:  "
        f"median={np.median(river[land]):.1f} max={river[land].max()}"
    )

    inside_distance = distance_transform_edt(land)
    terrain = rasters["terrain"].astype(np.float32)
    print()
    print("Quota terrain per fascia interna dalla costa:")
    for start, end in ((0, 1.5), (1.5, 3), (3, 6), (6, 12), (12, 24)):
        band = land & (inside_distance > start) & (inside_distance <= end)
        samples = terrain[band]
        print(
            f"  {start:4.1f}-{end:4.1f}px "
            f"p05={np.percentile(samples, 5):5.1f} "
            f"p50={np.percentile(samples, 50):5.1f} "
            f"p95={np.percentile(samples, 95):5.1f}"
        )

    edge = land & ~binary_erosion(land)
    print()
    edge_values = rasters["terrain"][edge]
    expected_edge_height = arguments.sea_level + 1
    print(
        "pixel costieri fuori quota raccordo: "
        f"{np.count_nonzero(edge_values != expected_edge_height):,}"
        f"/{edge_values.size:,} "
        f"(min={edge_values.min()}, max={edge_values.max()})"
    )

    print()
    print(
        "coast-distance non zero sulla terra: "
        f"{np.count_nonzero(rasters['coast'][land]):,}"
    )
    sea = ~land
    print(
        "coast-distance zero lontano dalla costa: "
        f"{np.count_nonzero((rasters['coast'] == 0) & sea):,}"
    )

    performance_paths = {
        "land": root / "selodia-land-mask-performance.png",
        "terrain": root / "selodia-terrain-heightmap-performance.png",
        "river": root / "selodia-rivers-aligned-performance.png",
        "coast": root / "selodia-coast-distance-performance.png",
        "bathymetry": root / "selodia-bathymetry-performance.png",
    }
    if all(path.exists() for path in performance_paths.values()):
        performance = {
            name: load_gray(path)
            for name, path in performance_paths.items()
        }
        print()
        print("Variante performance:")
        for name, values in performance.items():
            report(name, values)

        performance_land = performance["land"] >= 128
        performance_terrain_land = (
            performance["terrain"] > arguments.sea_level
        )
        expected_land = np.asarray(
            Image.fromarray(
                rasters["land"],
                mode="L",
            ).resize(
                (
                    performance["land"].shape[1],
                    performance["land"].shape[0],
                ),
                Image.Resampling.NEAREST,
            ),
            dtype=np.uint8,
        ) >= 128
        print(
            "  land/full-resize mismatch: "
            f"{np.count_nonzero(performance_land ^ expected_land):,}"
        )
        print(
            "  land/terrain mismatch:     "
            f"{np.count_nonzero(performance_land ^ performance_terrain_land):,}"
        )
        print(
            "  river ink at sea:          "
            f"{np.count_nonzero((performance['river'] > 0) & ~performance_land):,}"
        )
        print(
            "  coast nonzero on land:     "
            f"{np.count_nonzero(performance['coast'][performance_land]):,}"
        )


if __name__ == "__main__":
    main()
