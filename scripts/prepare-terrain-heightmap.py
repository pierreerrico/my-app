#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prepara la heightmap della mesh 3D, bloccando la costa al "
            "livello del mare e incidendo opzionalmente una river mask."
        ),
    )
    parser.add_argument("heightmap", type=Path)
    parser.add_argument("land_mask", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--rivers", type=Path)
    parser.add_argument("--aligned-rivers-output", type=Path)
    parser.add_argument("--sea-level", type=int, default=9)
    parser.add_argument("--river-depth", type=float, default=9.0)
    parser.add_argument("--river-width", type=int, default=7)
    parser.add_argument(
        "--terrain-blur",
        type=float,
        default=0.0,
        help="Smoothing della heightmap prima del displacement.",
    )
    parser.add_argument("--width", type=int)
    return parser.parse_args()


def mask_bounds(mask: np.ndarray) -> tuple[int, int, int, int]:
    rows, columns = np.where(mask)
    if rows.size == 0:
        raise ValueError("La maschera non contiene pixel validi.")
    return (
        int(columns.min()),
        int(rows.min()),
        int(columns.max()) + 1,
        int(rows.max()) + 1,
    )


def align_river_mask(
    river_image: Image.Image,
    target_land: np.ndarray,
) -> np.ndarray:
    river = np.asarray(river_image.convert("L"), dtype=np.uint8)
    if river.shape == target_land.shape:
        aligned = river.copy()
        aligned[~target_land] = 0
        aligned[target_land & (aligned == 0)] = 244
        return aligned

    source_bounds = mask_bounds(river > 0)
    target_bounds = mask_bounds(target_land)
    crop = Image.fromarray(
        river[
            source_bounds[1]:source_bounds[3],
            source_bounds[0]:source_bounds[2],
        ],
        mode="L",
    )
    fitted = crop.resize(
        (
            target_bounds[2] - target_bounds[0],
            target_bounds[3] - target_bounds[1],
        ),
        Image.Resampling.LANCZOS,
    )
    aligned = np.zeros(target_land.shape, dtype=np.uint8)
    aligned[
        target_bounds[1]:target_bounds[3],
        target_bounds[0]:target_bounds[2],
    ] = np.asarray(fitted, dtype=np.uint8)
    aligned[~target_land] = 0
    return aligned


def river_depth_map(
    aligned: np.ndarray,
    land: np.ndarray,
    width: int,
) -> np.ndarray:
    source_land = aligned > 8
    rivers = np.zeros(aligned.shape, dtype=np.float32)
    rivers[source_land] = np.clip(
        (236.0 - aligned[source_land]) / 182.0,
        0.0,
        1.0,
    )
    rivers[~land] = 0.0
    image = Image.fromarray(
        np.rint(rivers * 255.0).astype(np.uint8),
        mode="L",
    )
    filter_size = max(1, width)
    if filter_size % 2 == 0:
        filter_size += 1
    if filter_size > 1:
        image = image.filter(ImageFilter.MaxFilter(filter_size))
    image = image.filter(
        ImageFilter.GaussianBlur(radius=max(0.6, filter_size * 0.18)),
    )
    result = np.asarray(image, dtype=np.float32) / 255.0
    result[~land] = 0.0
    return result


def main() -> None:
    arguments = parse_arguments()
    with Image.open(arguments.heightmap) as image:
        height_image = image.convert("L")
    with Image.open(arguments.land_mask) as image:
        land_image = image.convert("L")

    if arguments.width and arguments.width != height_image.width:
        output_height = round(
            height_image.height * arguments.width / height_image.width,
        )
        output_size = (arguments.width, output_height)
        height_image = height_image.resize(
            output_size,
            Image.Resampling.LANCZOS,
        )
        land_image = land_image.resize(
            output_size,
            Image.Resampling.NEAREST,
        )

    if land_image.size != height_image.size:
        land_image = land_image.resize(
            height_image.size,
            Image.Resampling.NEAREST,
        )

    if arguments.terrain_blur > 0:
        height_image = height_image.filter(
            ImageFilter.GaussianBlur(
                radius=arguments.terrain_blur,
            ),
        )

    height = np.asarray(height_image, dtype=np.float32)
    land = np.asarray(land_image, dtype=np.uint8) >= 128

    # Anche i vertici trasparenti del mare partecipano all'interpolazione dei
    # triangoli costieri. Portarli a quota mare elimina il gradino scuro.
    prepared = np.maximum(height, float(arguments.sea_level))
    aligned_rivers: np.ndarray | None = None

    if arguments.rivers:
        with Image.open(arguments.rivers) as image:
            river_image = image.convert("L")
        if river_image.size != height_image.size:
            river_image = river_image.resize(
                height_image.size,
                Image.Resampling.LANCZOS,
            )
        aligned_rivers = align_river_mask(river_image, land)
        incision = river_depth_map(
            aligned_rivers,
            land,
            arguments.river_width,
        )
        prepared[land] -= incision[land] * arguments.river_depth

    prepared[land] = np.maximum(
        prepared[land],
        float(arguments.sea_level) + 1.0,
    )
    result = Image.fromarray(
        np.clip(np.rint(prepared), 0, 255).astype(np.uint8),
        mode="L",
    )

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(arguments.output, optimize=True)

    if arguments.aligned_rivers_output and aligned_rivers is not None:
        river_result = Image.fromarray(aligned_rivers, mode="L")
        if river_result.size != result.size:
            river_result = river_result.resize(
                result.size,
                Image.Resampling.LANCZOS,
            )
        arguments.aligned_rivers_output.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        river_result.save(arguments.aligned_rivers_output, optimize=True)

    print(f"Heightmap: {arguments.heightmap}")
    print(f"Output:    {arguments.output} ({result.width} x {result.height})")
    if arguments.rivers:
        print(f"Fiumi:     {arguments.rivers}")


if __name__ == "__main__":
    main()
