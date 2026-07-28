#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter


ColorStop = tuple[float, tuple[int, int, int]]

SEA_STOPS: tuple[ColorStop, ...] = (
    (0.00, (38, 83, 111)),
    (0.48, (48, 111, 137)),
    (1.00, (73, 151, 166)),
)

LAND_STOPS: tuple[ColorStop, ...] = (
    (0.00, (174, 170, 108)),
    (0.12, (177, 168, 105)),
    (0.30, (202, 166, 104)),
    (0.52, (169, 112, 75)),
    (0.74, (123, 78, 61)),
    (0.90, (184, 142, 101)),
    (1.00, (244, 225, 174)),
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
        "--land-mask",
        type=Path,
        help=(
            "Land mask esplicita. Necessaria quando la heightmap estende "
            "invisibilmente le quote oltre costa."
        ),
    )
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
        default=2.4,
        help="Esagerazione del rilievo usata dall'hillshade.",
    )
    parser.add_argument(
        "--blur",
        type=float,
        default=0.8,
        help="Sfocatura preventiva della heightmap in pixel.",
    )
    parser.add_argument(
        "--flat-smoothing",
        type=float,
        default=0.0,
        help=(
            "Smoothing aggiuntivo applicato soltanto nelle aree con poca "
            "variazione altimetrica."
        ),
    )
    parser.add_argument(
        "--shade-opacity",
        type=float,
        default=0.82,
        help="Intensita dell'ombreggiatura, tra 0 e 1.",
    )
    parser.add_argument(
        "--contour-step",
        type=int,
        default=6,
        help="Intervallo delle curve di livello in valori heightmap; 0 le disattiva.",
    )
    parser.add_argument(
        "--texture-bleed",
        type=float,
        default=0.0,
        help=(
            "Estende invisibilmente i colori terrestri oltre la land mask "
            "per impedire al filtro lineare di mescolarli con il mare."
        ),
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
    # Il gradiente per pixel si riduce aumentando la risoluzione. Questa
    # normalizzazione mantiene lo stesso rilievo apparente a 2K e a 8K.
    resolution_scale = height.shape[1] / 2048.0
    slope_scale = strength * 72.0 * resolution_scale
    nx = -dx * slope_scale
    ny = -dy * slope_scale
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


def contour_mask(height_u8: np.ndarray, land: np.ndarray, step: int) -> np.ndarray:
    if step <= 0:
        return np.zeros_like(height_u8, dtype=np.float32)
    bands = height_u8.astype(np.int16) // step
    boundary = np.zeros_like(land)
    boundary[:, 1:] |= bands[:, 1:] != bands[:, :-1]
    boundary[1:, :] |= bands[1:, :] != bands[:-1, :]
    boundary &= land
    return boundary.astype(np.float32)


def generate_relief_map(
    input_path: Path,
    output_path: Path,
    sea_level: int,
    azimuth: float,
    altitude: float,
    strength: float,
    blur: float,
    flat_smoothing: float,
    shade_opacity: float,
    contour_step: int,
    texture_bleed: float,
    width: int | None,
    land_mask_path: Path | None,
) -> None:
    if not 0 <= sea_level < 255:
        raise ValueError("--sea-level deve essere compreso tra 0 e 254.")
    if not 0.0 <= shade_opacity <= 1.0:
        raise ValueError("--shade-opacity deve essere compreso tra 0 e 1.")
    if width is not None and width <= 0:
        raise ValueError("--width deve essere maggiore di zero.")

    with Image.open(input_path) as source:
        height_image = source.convert("L")
    land_image: Image.Image | None = None
    if land_mask_path:
        with Image.open(land_mask_path) as source:
            land_image = source.convert("L")

    if width is not None and width != height_image.width:
        height = round(height_image.height * width / height_image.width)
        height_image = height_image.resize(
            (width, height),
            Image.Resampling.LANCZOS,
        )
        if land_image is not None:
            land_image = land_image.resize(
                (width, height),
                Image.Resampling.NEAREST,
            )

    source_values = np.asarray(height_image, dtype=np.float32)
    height_values = (
        gaussian_filter(source_values, sigma=blur, mode="nearest")
        if blur > 0
        else source_values.copy()
    )

    if flat_smoothing > 0:
        broadly_smoothed = gaussian_filter(
            source_values,
            sigma=flat_smoothing,
            mode="nearest",
        )
        # La selezione pianura/pendio deve ignorare la rugosità minuta:
        # misuriamo la pendenza sulla forma a grande scala, non sul dettaglio
        # che stiamo cercando di attenuare.
        dx, dy = sobel_gradients(broadly_smoothed / 255.0)
        # Compensa la risoluzione affinché il criterio di "pianura" rimanga
        # coerente tra atlas completo e variante performance.
        slope = np.hypot(dx, dy) * (height_values.shape[1] / 2048.0)
        flat_weight = 1.0 - np.clip(
            (slope - 0.0012) / (0.0105 - 0.0012),
            0.0,
            1.0,
        )
        flat_weight = flat_weight * flat_weight * (3.0 - 2.0 * flat_weight)
        height_values = (
            height_values * (1.0 - flat_weight)
            + broadly_smoothed * flat_weight
        )

    height_values = np.clip(height_values, 0.0, 255.0)
    height_u8 = np.clip(np.rint(height_values), 0, 255).astype(np.uint8)
    height = height_values / 255.0
    # La costa rimane quella della sorgente: lo smoothing non deve né
    # espandere né erodere la terra.
    land = (
        np.asarray(land_image, dtype=np.uint8) >= 128
        if land_image is not None
        else source_values > sea_level
    )

    sea_values = np.clip(
        height_values / max(sea_level, 1),
        0.0,
        1.0,
    )
    land_values = np.clip(
        (height_values - sea_level)
        / (255.0 - sea_level),
        0.0,
        1.0,
    )

    colors = interpolate_palette(sea_values, SEA_STOPS)
    land_colors = interpolate_palette(land_values, LAND_STOPS)
    colors[land] = land_colors[land]

    primary_shade = calculate_hillshade(
        height,
        azimuth=azimuth,
        altitude=altitude,
        strength=strength,
    )
    secondary_shade = calculate_hillshade(
        height,
        azimuth=azimuth + 110.0,
        altitude=max(altitude - 12.0, 12.0),
        strength=strength * 0.72,
    )
    # La luce principale modella la forma; una seconda luce debole conserva
    # i dettagli nei versanti in ombra, come nei shaded relief cartografici.
    shade = np.clip(primary_shade * 0.82 + secondary_shade * 0.18, 0.0, 1.0)
    # Il feather geometrico della costa non è un versante reale e non deve
    # diventare una corona d'ombra nella texture. Riporta gradualmente
    # l'illuminazione al valore neutro soltanto vicino al bordo interno.
    inside_distance = distance_transform_edt(land)
    coast_neutral_width = max(3.0, height.shape[1] / 8192.0 * 20.0)
    coast_shade_weight = np.clip(
        (inside_distance - coast_neutral_width * 0.2)
        / (coast_neutral_width * 0.8),
        0.0,
        1.0,
    )
    coast_shade_weight = (
        coast_shade_weight
        * coast_shade_weight
        * (3.0 - 2.0 * coast_shade_weight)
    )
    neutral_shade = (1.0 - 0.34) / 1.12
    shade[land] = (
        neutral_shade * (1.0 - coast_shade_weight[land])
        + shade[land] * coast_shade_weight[land]
    )
    shade_multiplier = 0.34 + shade * 1.12
    effective_opacity = np.where(land, shade_opacity, shade_opacity * 0.16)
    colors *= (
        1.0
        + (
            (shade_multiplier - 1.0) * effective_opacity
        )[..., None]
    )

    contours = contour_mask(height_u8, land, contour_step)
    if contour_step > 0:
        index_contours = contour_mask(
            height_u8,
            land,
            contour_step * 5,
        )
        contour_alpha = np.clip(contours * 0.24 + index_contours * 0.28, 0.0, 0.48)
        contour_color = np.asarray((70, 47, 38), dtype=np.float32)
        colors = (
            colors * (1.0 - contour_alpha[..., None])
            + contour_color * contour_alpha[..., None]
        )

    if texture_bleed > 0:
        sea_distance, nearest_land = distance_transform_edt(
            ~land,
            return_indices=True,
        )
        bleed = (~land) & (sea_distance <= texture_bleed)
        colors[bleed] = colors[
            nearest_land[0][bleed],
            nearest_land[1][bleed],
        ]

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
        flat_smoothing=arguments.flat_smoothing,
        shade_opacity=arguments.shade_opacity,
        contour_step=arguments.contour_step,
        texture_bleed=arguments.texture_bleed,
        width=arguments.width,
        land_mask_path=arguments.land_mask,
    )


if __name__ == "__main__":
    main()
