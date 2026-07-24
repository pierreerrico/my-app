#!/usr/bin/env python3
"""Misura la copertura terrestre di una land mask e stima l'area emersa."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mask", type=Path)
    parser.add_argument("map_width_km", type=float)
    parser.add_argument("map_height_km", type=float)
    args = parser.parse_args()

    if args.map_width_km <= 0 or args.map_height_km <= 0:
        raise SystemExit("Larghezza e altezza devono essere positive.")

    image = Image.open(args.mask).convert("RGBA")
    pixels = list(image.getdata()) # type: ignore

    covered = 0.0
    for red, green, blue, alpha in pixels:
        luminance = (
            0.2126 * red / 255
            + 0.7152 * green / 255
            + 0.0722 * blue / 255
        )
        covered += luminance * (alpha / 255)

    land_coverage_ratio = covered / len(pixels)
    map_area_km2 = args.map_width_km * args.map_height_km

    result = {
        "mask": str(args.mask),
        "pixels": {"width": image.width, "height": image.height},
        "mapWidthKm": args.map_width_km,
        "mapHeightKm": args.map_height_km,
        "mapAreaKm2": map_area_km2,
        "landCoverageRatio": land_coverage_ratio,
        "landCoveragePercent": land_coverage_ratio * 100,
        "estimatedTerritoryAreaKm2": map_area_km2 * land_coverage_ratio,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
