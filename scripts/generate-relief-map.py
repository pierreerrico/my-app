#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ColorStop = tuple[float, tuple[int, int, int]]

SEA_STOPS: tuple[ColorStop, ...] = (
    (0.00, (38, 83, 111)),
    (0.48, (48, 111, 137)),
    (1.00, (73, 151, 166)),
)

LAND_STOPS: tuple[ColorStop, ...] = (
    (0.00, (105, 145, 102)),
    (0.12, (151, 174, 111)),
    (0.32, (199, 190, 132)),
    (0.56, (176, 142, 94)),
    (0.78, (137, 105, 77)),
    (1.00, (235, 226, 205)),
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Genera una carta fisica in rilievo da una heightmap in scala "
            "di grigi, combinando tinte ipsometriche e hillshade."
        ),
    )
    parser.add_argument("input", type=Path, help="Heightmap sorgente.")
    parser.add_argument("output", type=Path, help="PNG di destinazione.")
    parser.add_argument(
        "--sea-level",
        type=int,
        default=9,
        help="Ultimo valore della heightmap considerato mare (default: 9).",
    )
    parser.add_argument(
        "--azimuth",
        type=float,
        default=315.0,
        help="Direzione della luce in gradi, da nord in senso orario.",
    )
    parser.add_argument(
        "--altitude",
        type=float,
        default=42.0,
        help="Altezza della luce sull'orizzonte in gradi.",
    )
    parser.add_argument(
        "--strength",
        type=float,
        default=7.0,
        help="Esagerazione del rilievo usata dall'hillshade.",
    )
    parser.add_argument(
        "--blur",
        type=float,
        default=0.8,
        help="Sfocatura preventiva della heightmap in pixel.",
    )
    parser.add_argument(
        "--shade-opacity",
        type=float,
        default=0.58,
        help="Intensita dell'ombreggiatura, tra 0 e 1.",
    )
    parser.add_argument(
        "--width",
        type=int,
        help="Ridimensiona l'output a questa larghezza mantenendo le proporzioni.",
    )
    return parser.parse_args()


def interpolate_palette(
    values: np.ndarray,
    stops: tuple[ColorStop, ...],
) -> np.ndarray:
    result = np.empty((*values.shape, 3), dtype=np.float32)
    positions = np.asarray([stop[0] for stop in stops], dtype=np.float32)

    for channel in range(3):
        colors = np.asarray(
            [stop[1][channel] for stop in stops],
            dtype=np.float32,
        )
        result[..., channel] = np.interp(values, positions, colors)

    return result


def sobel_gradients(height: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    padded = np.pad(height, ((1, 1), (1, 1)), mode="edge")
    dx = (
        padded[:-2, 2:]
        + 2.0 * padded[1:-1, 2:]
        + padded[2:, 2:]
        - padded[:-2, :-2]
        - 2.0 * padded[1:-1, :-2]
        - padded[2:, :-2]
    ) / 8.0
    dy = (
        padded[2:, :-2]
        + 2.0 * padded[2:, 1:-1]
        + padded[2:, 2:]
        - padded[:-2, :-2]
        - 2.0 * padded[:-2, 1:-1]
        - padded[:-2, 2:]
    ) / 8.0
    return dx, dy


def calculate_hillshade(
    height: np.ndarray,
    azimuth: float,
    altitude: float,
    strength: float,
) -> np.ndarray:
    dx, dy = sobel_gradients(height)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(height)
    normal_length = np.sqrt(nx * nx + ny * ny + nz * nz)

    nx /= normal_length
    ny /= normal_length
    nz /= normal_length

    azimuth_radians = math.radians(azimuth)
    altitude_radians = math.radians(altitude)
    horizontal = math.cos(altitude_radians)
    light_x = math.sin(azimuth_radians) * horizontal
    light_y = -math.cos(azimuth_radians) * horizontal
    light_z = math.sin(altitude_radians)

    illumination = nx * light_x + ny * light_y + nz * light_z
    return np.clip(illumination * 0.5 + 0.5, 0.0, 1.0)


def generate_relief_map(
    input_path: Path,
    output_path: Path,
    sea_level: int,
    azimuth: float,
    altitude: float,
    strength: float,
    blur: float,
    shade_opacity: float,
    width: int | None,
) -> None:
    if not 0 <= sea_level < 255:
        raise ValueError("--sea-level deve essere compreso tra 0 e 254.")
    if not 0.0 <= shade_opacity <= 1.0:
        raise ValueError("--shade-opacity deve essere compreso tra 0 e 1.")
    if width is not None and width <= 0:
        raise ValueError("--width deve essere maggiore di zero.")

    with Image.open(input_path) as source:
        height_image = source.convert("L")

    if width is not None and width != height_image.width:
        height = round(height_image.height * width / height_image.width)
        height_image = height_image.resize(
            (width, height),
            Image.Resampling.LANCZOS,
        )

    smoothed = (
        height_image.filter(ImageFilter.GaussianBlur(radius=blur))
        if blur > 0
        else height_image
    )
    height_u8 = np.asarray(smoothed, dtype=np.uint8)
    height = height_u8.astype(np.float32) / 255.0
    land = height_u8 > sea_level

    sea_values = np.clip(
        height_u8.astype(np.float32) / max(sea_level, 1),
        0.0,
        1.0,
    )
    land_values = np.clip(
        (height_u8.astype(np.float32) - sea_level)
        / (255.0 - sea_level),
        0.0,
        1.0,
    )

    colors = interpolate_palette(sea_values, SEA_STOPS)
    land_colors = interpolate_palette(land_values, LAND_STOPS)
    colors[land] = land_colors[land]

    shade = calculate_hillshade(
        height,
        azimuth=azimuth,
        altitude=altitude,
        strength=strength,
    )
    # Mantiene leggibili i colori, scurendo i versanti in ombra e
    # schiarendo con moderazione quelli rivolti alla luce.
    shade_multiplier = 0.58 + shade * 0.62
    effective_opacity = np.where(land, shade_opacity, shade_opacity * 0.16)
    colors *= (
        1.0
        + (
            (shade_multiplier - 1.0) * effective_opacity
        )[..., None]
    )

    result = Image.fromarray(
        np.clip(np.rint(colors), 0, 255).astype(np.uint8),
        mode="RGB",
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, optimize=True)

    print(f"Input:      {input_path}")
    print(f"Output:     {output_path}")
    print(f"Dimensioni: {result.width} x {result.height}")
    print(f"Mare:       <= {sea_level}")
    print(f"Luce:       azimuth {azimuth:g}, altezza {altitude:g}")


def main() -> None:
    arguments = parse_arguments()
    generate_relief_map(
        input_path=arguments.input,
        output_path=arguments.output,
        sea_level=arguments.sea_level,
        azimuth=arguments.azimuth,
        altitude=arguments.altitude,
        strength=arguments.strength,
        blur=arguments.blur,
        shade_opacity=arguments.shade_opacity,
        width=arguments.width,
    )


if __name__ == "__main__":
    main()
