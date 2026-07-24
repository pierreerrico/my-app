#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Genera una texture di distanza dalla costa "
            "a partire da una land mask binaria."
        ),
    )

    parser.add_argument(
        "map_id",
        help="Identificatore della mappa, per esempio: selodia",
    )

    parser.add_argument(
        "--maximum-distance",
        type=float,
        default=180.0,
        help=(
            "Distanza in pixel oltre la quale il valore viene saturato. "
            "Default: 180."
        ),
    )

    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()

    map_id = arguments.map_id.strip().lower()

    if not map_id:
        raise ValueError(
            "L'identificatore della mappa non può essere vuoto."
        )

    maximum_distance = arguments.maximum_distance

    if maximum_distance <= 0:
        raise ValueError(
            "La distanza massima deve essere maggiore di zero."
        )

    map_directory = (
        PROJECT_ROOT
        / "public"
        / "maps"
        / map_id
    )

    land_mask_path = (
        map_directory
        / f"{map_id}-land-mask.png"
    )

    output_path = (
        map_directory
        / f"{map_id}-coast-distance.png"
    )

    if not land_mask_path.exists():
        raise FileNotFoundError(
            f"Land mask non trovata: {land_mask_path}"
        )

    with Image.open(land_mask_path) as image:
        land_mask = np.asarray(
            image.convert("L"),
            dtype=np.uint8,
        )

    land = land_mask > 127
    sea = ~land

    distance_from_land = distance_transform_edt(
        sea
    )

    normalized_distance = np.clip(
        distance_from_land / maximum_distance,
        0.0,
        1.0,
    )

    distance_texture = np.where(
        sea,
        normalized_distance * 255.0,
        0.0,
    ).astype(np.uint8)

    output_image = Image.fromarray(
        distance_texture,
        mode="L",
    )

    output_image.save(
        output_path,
        format="PNG",
        optimize=False,
    )

    print(
        "Land mask:",
        land_mask_path.relative_to(PROJECT_ROOT),
    )

    print(
        "Texture costiera:",
        output_path.relative_to(PROJECT_ROOT),
    )

    print(
        "Risoluzione:",
        f"{output_image.width} × {output_image.height}",
    )

    print(
        "Distanza massima:",
        f"{maximum_distance:.2f} px",
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())