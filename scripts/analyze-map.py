#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MAPS_DATA_DIRECTORY = PROJECT_ROOT / "app" / "data" / "maps"
GENERATED_DIRECTORY = MAPS_DATA_DIRECTORY / "generated"


@dataclass(frozen=True)
class MapFiles:
    map_id: str
    source_file: Path
    analysis_file: Path


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Analizza la heightmap di una carta, genera la land mask "
            "e calcola la superficie terrestre."
        ),
    )

    parser.add_argument(
        "map_id",
        help=(
            "Identificatore della mappa. "
            "Esempio: selodia"
        ),
    )

    parser.add_argument(
        "--source",
        type=Path,
        help=(
            "Percorso alternativo al file source JSON. "
            "Se omesso viene usato "
            "app/data/maps/<map-id>/<map-id>-source.json."
        ),
    )

    parser.add_argument(
        "--analysis",
        type=Path,
        help=(
            "Percorso alternativo al file JSON di output. "
            "Se omesso viene usato "
            "app/data/maps/generated/<map-id>-analysis.json."
        ),
    )

    return parser.parse_args()


def validate_map_id(map_id: str) -> str:
    normalized = map_id.strip().lower()

    if not normalized:
        raise ValueError(
            "L'identificatore della mappa non può essere vuoto."
        )

    allowed_characters = set(
        "abcdefghijklmnopqrstuvwxyz0123456789-_"
    )

    if any(
        character not in allowed_characters
        for character in normalized
    ):
        raise ValueError(
            "L'identificatore della mappa può contenere soltanto "
            "lettere minuscole, numeri, trattini e underscore."
        )

    return normalized


def resolve_inside_project(path: Path) -> Path:
    if not path.is_absolute():
        path = PROJECT_ROOT / path

    resolved = path.resolve()

    try:
        resolved.relative_to(PROJECT_ROOT)
    except ValueError as error:
        raise ValueError(
            f"Il percorso deve rimanere all'interno del progetto: {resolved}"
        ) from error

    return resolved


def build_map_files(
    map_id: str,
    source_override: Path | None,
    analysis_override: Path | None,
) -> MapFiles:
    default_source = (
        MAPS_DATA_DIRECTORY
        / map_id
        / f"{map_id}-source.json"
    )

    default_analysis = (
        GENERATED_DIRECTORY
        / f"{map_id}-analysis.json"
    )

    source_file = resolve_inside_project(
        source_override
        if source_override is not None
        else default_source
    )

    analysis_file = resolve_inside_project(
        analysis_override
        if analysis_override is not None
        else default_analysis
    )

    return MapFiles(
        map_id=map_id,
        source_file=source_file,
        analysis_file=analysis_file,
    )


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"File non trovato: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8",
    ) as file:
        content = json.load(file)

    if not isinstance(content, dict):
        raise ValueError(
            f"Il file deve contenere un oggetto JSON: {path}"
        )

    return content


def write_json(
    path: Path,
    content: dict[str, Any],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            content,
            file,
            ensure_ascii=False,
            indent=2,
        )

        file.write("\n")


def require_object(
    container: dict[str, Any],
    key: str,
) -> dict[str, Any]:
    value = container.get(key)

    if not isinstance(value, dict):
        raise ValueError(
            f'La proprietà "{key}" deve essere un oggetto JSON.'
        )

    return value


def require_string(
    container: dict[str, Any],
    key: str,
) -> str:
    value = container.get(key)

    if not isinstance(value, str) or not value.strip():
        raise ValueError(
            f'La proprietà "{key}" deve essere una stringa non vuota.'
        )

    return value.strip()


def require_positive_float(
    container: dict[str, Any],
    key: str,
) -> float:
    value = container.get(key)

    if isinstance(value, bool):
        raise ValueError(
            f'La proprietà "{key}" deve essere numerica.'
        )

    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f'La proprietà "{key}" deve essere numerica.'
        ) from error

    if number <= 0:
        raise ValueError(
            f'La proprietà "{key}" deve essere maggiore di zero.'
        )

    return number


def require_byte_value(
    container: dict[str, Any],
    key: str,
) -> int:
    value = container.get(key)

    if isinstance(value, bool):
        raise ValueError(
            f'La proprietà "{key}" deve essere un intero tra 0 e 255.'
        )

    try:
        number = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f'La proprietà "{key}" deve essere un intero tra 0 e 255.'
        ) from error

    if not 0 <= number <= 255:
        raise ValueError(
            f'La proprietà "{key}" deve essere compresa tra 0 e 255.'
        )

    return number


def analyze_heightmap(
    source: dict[str, Any],
) -> dict[str, Any]:
    map_width_km = require_positive_float(
        source,
        "mapWidthKm",
    )

    map_height_km = require_positive_float(
        source,
        "mapHeightKm",
    )

    heightmap_definition = require_object(
        source,
        "heightmap",
    )

    land_mask_definition = require_object(
        source,
        "generatedLandMask",
    )

    sea_level = require_byte_value(
        heightmap_definition,
        "seaLevel",
    )

    heightmap_relative_path = require_string(
        heightmap_definition,
        "file",
    )

    land_mask_relative_path = require_string(
        land_mask_definition,
        "file",
    )

    heightmap_path = resolve_inside_project(
        Path(heightmap_relative_path)
    )

    land_mask_path = resolve_inside_project(
        Path(land_mask_relative_path)
    )

    if not heightmap_path.exists():
        raise FileNotFoundError(
            f"Heightmap non trovata: {heightmap_path}"
        )

    with Image.open(heightmap_path) as original_image:
        print(
            "Heightmap caricata:",
            heightmap_path.relative_to(PROJECT_ROOT),
        )

        print(
            "Formato originale:",
            original_image.mode,
        )

        print(
            "Canali originali:",
            original_image.getbands(),
        )

        print(
            "Risoluzione:",
            f"{original_image.width} × {original_image.height}",
        )

        rgba_image = original_image.convert("RGBA")

        alpha_channel = rgba_image.getchannel("A")

        transparent_pixels = sum(
            1
            for alpha_value in alpha_channel.getdata()
            if alpha_value < 255
        )

        print(
            "Pixel con trasparenza:",
            f"{transparent_pixels:,}",
        )

        black_background = Image.new(
            "RGBA",
            rgba_image.size,
            (0, 0, 0, 255),
        )

        flattened_image = Image.alpha_composite(
            black_background,
            rgba_image,
        )

        heightmap = flattened_image.convert("L")

    width_px, height_px = heightmap.size

    if width_px <= 0 or height_px <= 0:
        raise ValueError(
            "La heightmap non contiene pixel validi."
        )

    source_pixels = list(
        heightmap.getdata()
    )

    if not source_pixels:
        raise ValueError(
            "La heightmap non contiene pixel analizzabili."
        )

    minimum_value = min(source_pixels)
    maximum_value = max(source_pixels)

    print(
        "Intervallo grayscale:",
        f"{minimum_value}–{maximum_value}",
    )

    print(
        "Livello del mare applicato:",
        sea_level,
    )

    mask_pixels = [
        255 if pixel_value > sea_level else 0
        for pixel_value in source_pixels
    ]

    land_pixels = sum(
        1
        for pixel_value in source_pixels
        if pixel_value > sea_level
    )

    total_pixels = len(source_pixels)
    sea_pixels = total_pixels - land_pixels

    land_coverage_ratio = (
        land_pixels / total_pixels
    )

    map_area_km2 = (
        map_width_km *
        map_height_km
    )

    territory_area_km2 = (
        map_area_km2 *
        land_coverage_ratio
    )

    land_mask = Image.new(
        "L",
        (width_px, height_px),
        color=0,
    )

    land_mask.putdata(
        mask_pixels
    )

    land_mask_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    land_mask.save(
        land_mask_path,
        format="PNG",
        optimize=False,
    )

    with Image.open(land_mask_path) as saved_mask:
        verified_mask = saved_mask.convert("L")

        unique_values = set(
            verified_mask.getdata()
        )

    if not unique_values.issubset({0, 255}):
        raise RuntimeError(
            "La land mask generata non è binaria. "
            f"Valori trovati: {sorted(unique_values)}"
        )

    print(
        "Land mask generata:",
        land_mask_path.relative_to(PROJECT_ROOT),
    )

    print(
        "Valori presenti nella mask:",
        sorted(unique_values),
    )

    return {
        "imageWidthPx": width_px,
        "imageHeightPx": height_px,
        "totalPixels": total_pixels,
        "landPixels": land_pixels,
        "seaPixels": sea_pixels,
        "seaLevel": sea_level,
        "minimumHeightValue": minimum_value,
        "maximumHeightValue": maximum_value,
        "landCoverageRatio": round(
            land_coverage_ratio,
            12,
        ),
        "mapAreaKm2": round(
            map_area_km2,
            6,
        ),
        "territoryAreaKm2": round(
            territory_area_km2,
            6,
        ),
    }


def print_report(
    map_id: str,
    source_file: Path,
    analysis_file: Path,
    analysis: dict[str, Any],
) -> None:
    print()
    print(f'Mappa: "{map_id}"')

    print(
        "Source:",
        source_file.relative_to(PROJECT_ROOT),
    )

    print(
        "Analisi:",
        analysis_file.relative_to(PROJECT_ROOT),
    )

    print(
        "Risoluzione:",
        f"{analysis['imageWidthPx']} × "
        f"{analysis['imageHeightPx']} px",
    )

    print(
        "Livello del mare:",
        analysis["seaLevel"],
    )

    print(
        "Intervallo grayscale:",
        f"{analysis['minimumHeightValue']}–"
        f"{analysis['maximumHeightValue']}",
    )

    print(
        "Pixel terrestri:",
        f"{analysis['landPixels']:,}",
    )

    print(
        "Pixel marini:",
        f"{analysis['seaPixels']:,}",
    )

    print(
        "Copertura terrestre:",
        f"{analysis['landCoverageRatio'] * 100:.4f}%",
    )

    print(
        "Superficie della carta:",
        f"{analysis['mapAreaKm2']:.2f} km²",
    )

    print(
        "Superficie del territorio:",
        f"{analysis['territoryAreaKm2']:.2f} km²",
    )


def main() -> int:
    try:
        arguments = parse_arguments()

        map_id = validate_map_id(
            arguments.map_id
        )

        files = build_map_files(
            map_id=map_id,
            source_override=arguments.source,
            analysis_override=arguments.analysis,
        )

        source = read_json(
            files.source_file
        )

        analysis = analyze_heightmap(
            source
        )

        write_json(
            files.analysis_file,
            analysis,
        )

        print_report(
            map_id=files.map_id,
            source_file=files.source_file,
            analysis_file=files.analysis_file,
            analysis=analysis,
        )

        return 0

    except (
        FileNotFoundError,
        KeyError,
        OSError,
        RuntimeError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        print(
            f"Errore: {error}",
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(main())