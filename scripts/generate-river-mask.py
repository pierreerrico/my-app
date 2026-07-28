#!/usr/bin/env python3

from __future__ import annotations

import argparse
import heapq
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


NEIGHBORS = (
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Genera una river mask idrologicamente coerente da una "
            "heightmap tramite Priority-Flood, routing D8 e flow accumulation."
        ),
    )
    parser.add_argument("heightmap", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sea-level", type=int, default=9)
    parser.add_argument(
        "--analysis-width",
        type=int,
        default=2048,
        help="Larghezza del raster idrologico intermedio (default: 2048).",
    )
    parser.add_argument(
        "--map-width-km",
        type=float,
        default=390.0,
        help="Larghezza fisica della carta (default: 390 km).",
    )
    parser.add_argument(
        "--min-basin-km2",
        type=float,
        default=55.0,
        help="Bacino contribuente minimo per iniziare un fiume.",
    )
    parser.add_argument(
        "--river-width",
        type=int,
        default=1,
        help="Raggio di espansione dei corsi sul raster intermedio.",
    )
    parser.add_argument(
        "--smooth-radius",
        type=float,
        default=1.25,
        help="Smoothing finale dei bordi fluviali in pixel nativi.",
    )
    parser.add_argument(
        "--land-value",
        type=int,
        default=244,
        help="Valore della terra nella maschera risultante.",
    )
    parser.add_argument(
        "--diagnostics",
        type=Path,
        help="Directory opzionale per accumulation e DEM riempito.",
    )
    return parser.parse_args()


def coastal_seeds(land: np.ndarray) -> np.ndarray:
    padded = np.pad(land, 1, mode="constant", constant_values=False)
    surrounded = np.ones_like(land, dtype=bool)
    for row_offset, column_offset in NEIGHBORS:
        surrounded &= padded[
            1 + row_offset:1 + row_offset + land.shape[0],
            1 + column_offset:1 + column_offset + land.shape[1],
        ]
    seeds = land & ~surrounded
    seeds[0, :] |= land[0, :]
    seeds[-1, :] |= land[-1, :]
    seeds[:, 0] |= land[:, 0]
    seeds[:, -1] |= land[:, -1]
    return seeds


def priority_flood(
    elevation: np.ndarray,
    land: np.ndarray,
) -> np.ndarray:
    """
    Riempie depressioni e superfici piatte partendo dagli sbocchi costieri.

    Un incremento float minimo assegna alle depressioni una pendenza
    infinitesimale verso il relativo punto di sfioro.
    """
    rows, columns = elevation.shape
    filled = elevation.astype(np.float32, copy=True)
    visited = ~land.copy()
    queue: list[tuple[float, int]] = []

    for index in np.flatnonzero(coastal_seeds(land)):
        visited.flat[index] = True
        heapq.heappush(queue, (float(filled.flat[index]), int(index)))

    while queue:
        current_height, index = heapq.heappop(queue)
        row, column = divmod(index, columns)
        spill_height = np.nextafter(
            np.float32(current_height),
            np.float32(np.inf),
        )

        for row_offset, column_offset in NEIGHBORS:
            next_row = row + row_offset
            next_column = column + column_offset
            if not (
                0 <= next_row < rows
                and 0 <= next_column < columns
            ):
                continue
            if visited[next_row, next_column]:
                continue

            visited[next_row, next_column] = True
            next_height = max(
                float(filled[next_row, next_column]),
                float(spill_height),
            )
            filled[next_row, next_column] = next_height
            next_index = next_row * columns + next_column
            heapq.heappush(queue, (next_height, next_index))

    return filled


def d8_receivers(
    filled: np.ndarray,
    land: np.ndarray,
) -> np.ndarray:
    rows, columns = filled.shape
    receiver = np.full(filled.size, -1, dtype=np.int32)
    best_slope = np.zeros(filled.shape, dtype=np.float32)

    for row_offset, column_offset in NEIGHBORS:
        row_start = max(0, -row_offset)
        row_end = min(rows, rows - row_offset)
        column_start = max(0, -column_offset)
        column_end = min(columns, columns - column_offset)

        source_slice = (
            slice(row_start, row_end),
            slice(column_start, column_end),
        )
        target_slice = (
            slice(row_start + row_offset, row_end + row_offset),
            slice(
                column_start + column_offset,
                column_end + column_offset,
            ),
        )
        distance = 1.41421356 if row_offset and column_offset else 1.0
        slope = (
            filled[source_slice] - filled[target_slice]
        ) / distance
        valid = (
            land[source_slice]
            & land[target_slice]
            & (slope > best_slope[source_slice])
        )
        if not np.any(valid):
            continue

        local_rows, local_columns = np.where(valid)
        source_rows = local_rows + row_start
        source_columns = local_columns + column_start
        target_rows = source_rows + row_offset
        target_columns = source_columns + column_offset
        source_indices = source_rows * columns + source_columns
        target_indices = target_rows * columns + target_columns

        receiver[source_indices] = target_indices
        best_slope[source_rows, source_columns] = slope[valid]

    return receiver


def flow_accumulation(
    filled: np.ndarray,
    land: np.ndarray,
    receiver: np.ndarray,
) -> np.ndarray:
    accumulation = np.zeros(filled.size, dtype=np.float32)
    land_indices = np.flatnonzero(land)
    accumulation[land_indices] = 1.0
    order = land_indices[
        np.argsort(filled.flat[land_indices], kind="stable")[::-1]
    ]

    for index in order:
        target = receiver[index]
        if target >= 0:
            accumulation[target] += accumulation[index]

    return accumulation.reshape(filled.shape)


def strahler_order(
    filled: np.ndarray,
    stream: np.ndarray,
    receiver: np.ndarray,
) -> np.ndarray:
    order = np.zeros(filled.size, dtype=np.uint8)
    maximum_upstream = np.zeros(filled.size, dtype=np.uint8)
    maximum_count = np.zeros(filled.size, dtype=np.uint8)
    stream_indices = np.flatnonzero(stream)
    ordered = stream_indices[
        np.argsort(filled.flat[stream_indices], kind="stable")[::-1]
    ]

    for index in ordered:
        upstream_order = maximum_upstream[index]
        if upstream_order == 0:
            order[index] = 1
        elif maximum_count[index] >= 2:
            order[index] = min(255, int(upstream_order) + 1)
        else:
            order[index] = upstream_order

        target = receiver[index]
        if target < 0 or not stream.flat[target]:
            continue
        if order[index] > maximum_upstream[target]:
            maximum_upstream[target] = order[index]
            maximum_count[target] = 1
        elif order[index] == maximum_upstream[target]:
            maximum_count[target] = min(
                255,
                int(maximum_count[target]) + 1,
            )

    return order.reshape(filled.shape)


def extract_streams(
    land: np.ndarray,
    accumulation: np.ndarray,
    minimum_cells: float,
) -> np.ndarray:
    stream = land & (accumulation >= minimum_cells)
    return stream


def render_hierarchical_mask(
    land: np.ndarray,
    accumulation: np.ndarray,
    stream: np.ndarray,
    order: np.ndarray,
    minimum_cells: float,
    land_value: int,
    maximum_width: int,
) -> Image.Image:
    relative_flow = np.zeros(accumulation.shape, dtype=np.float32)
    if np.any(stream):
        logarithmic = np.log1p(accumulation[stream])
        start = np.log1p(minimum_cells)
        end = max(float(logarithmic.max()), start + 1e-6)
        relative_flow[stream] = np.clip(
            (logarithmic - start) / (end - start),
            0.0,
            1.0,
        )

    maximum_order = max(int(order.max()), 1)
    relative_order = np.zeros(order.shape, dtype=np.float32)
    if maximum_order > 1:
        relative_order[stream] = (
            order[stream].astype(np.float32) - 1.0
        ) / (maximum_order - 1.0)

    # L'accumulo fa crescere il corso verso valle; Strahler rende più
    # importanti i rami nati dalla confluenza di tributari equivalenti.
    hierarchy = np.maximum(
        relative_flow,
        relative_order * 0.88,
    )
    ink = np.zeros(land.shape, dtype=np.float32)
    ink[stream] = 0.06 + hierarchy[stream] ** 1.35 * 0.94
    rendered_ink = ink.copy()

    maximum_width = max(0, maximum_width)
    if maximum_width:
        desired_radius = np.zeros(land.shape, dtype=np.uint8)
        desired_radius[stream] = np.floor(
            hierarchy[stream] * (maximum_width + 0.999),
        ).astype(np.uint8)

        for radius in range(1, maximum_width + 1):
            eligible = np.where(
                desired_radius >= radius,
                np.rint(ink * 255.0),
                0,
            ).astype(np.uint8)
            expanded = Image.fromarray(
                eligible,
                mode="L",
            ).filter(
                ImageFilter.MaxFilter(radius * 2 + 1),
            )
            rendered_ink = np.maximum(
                rendered_ink,
                np.asarray(expanded, dtype=np.float32) / 255.0,
            )

    mask = np.zeros(land.shape, dtype=np.float32)
    mask[land] = land_value
    mask[land] -= rendered_ink[land] * 190.0
    result = Image.fromarray(
        np.clip(np.rint(mask), 0, 255).astype(np.uint8),
        mode="L",
    )
    return result


def save_diagnostics(
    directory: Path,
    filled: np.ndarray,
    accumulation: np.ndarray,
    land: np.ndarray,
    order: np.ndarray,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    filled_preview = np.zeros(filled.shape, dtype=np.uint8)
    land_values = filled[land]
    if land_values.size:
        minimum = float(land_values.min())
        maximum = float(land_values.max())
        if maximum > minimum:
            filled_preview[land] = np.clip(
                (land_values - minimum) / (maximum - minimum) * 255.0,
                0,
                255,
            ).astype(np.uint8)
    Image.fromarray(filled_preview, mode="L").save(
        directory / "filled-dem.png",
    )

    accumulation_preview = np.zeros(accumulation.shape, dtype=np.uint8)
    if np.any(land):
        logged = np.log1p(accumulation[land])
        maximum = max(float(logged.max()), 1e-6)
        accumulation_preview[land] = np.clip(
            logged / maximum * 255.0,
            0,
            255,
        ).astype(np.uint8)
    Image.fromarray(accumulation_preview, mode="L").save(
        directory / "flow-accumulation.png",
    )
    if order.max() > 0:
        order_preview = np.rint(
            order.astype(np.float32) / order.max() * 255.0,
        ).astype(np.uint8)
        Image.fromarray(order_preview, mode="L").save(
            directory / "strahler-order.png",
        )


def main() -> None:
    arguments = parse_arguments()
    with Image.open(arguments.heightmap) as source:
        original_size = source.size
        heightmap = source.convert("L")

    analysis_width = min(arguments.analysis_width, original_size[0])
    analysis_height = round(
        original_size[1] * analysis_width / original_size[0],
    )
    heightmap = heightmap.resize(
        (analysis_width, analysis_height),
        Image.Resampling.LANCZOS,
    )
    elevation = np.asarray(heightmap, dtype=np.float32)
    land = elevation > arguments.sea_level

    filled = priority_flood(elevation, land)
    receiver = d8_receivers(filled, land)
    accumulation = flow_accumulation(filled, land, receiver)

    map_height_km = (
        arguments.map_width_km * original_size[1] / original_size[0]
    )
    cell_area_km2 = (
        arguments.map_width_km / analysis_width
    ) * (
        map_height_km / analysis_height
    )
    minimum_cells = max(
        2.0,
        arguments.min_basin_km2 / cell_area_km2,
    )
    stream = extract_streams(
        land,
        accumulation,
        minimum_cells,
    )
    order = strahler_order(
        filled,
        stream,
        receiver,
    )
    result = render_hierarchical_mask(
        land,
        accumulation,
        stream,
        order,
        minimum_cells,
        arguments.land_value,
        arguments.river_width,
    ).resize(original_size, Image.Resampling.LANCZOS)

    # Il resize della maschera idrografica non deve creare un alone oltre la
    # costa. La sagoma finale viene ripresa dalla heightmap nativa.
    with Image.open(arguments.heightmap) as source:
        native_land = np.asarray(
            source.convert("L"),
            dtype=np.uint8,
        ) > arguments.sea_level
    result_values = np.asarray(result, dtype=np.uint8).copy()
    result_values[~native_land] = 0
    result_values[
        native_land & (result_values == 0)
    ] = arguments.land_value

    if arguments.smooth_radius > 0:
        river_ink = np.zeros(result_values.shape, dtype=np.uint8)
        river_ink[native_land] = (
            arguments.land_value - result_values[native_land]
        )
        smoothed_ink = np.asarray(
            Image.fromarray(river_ink, mode="L").filter(
                ImageFilter.GaussianBlur(
                    radius=arguments.smooth_radius,
                ),
            ),
            dtype=np.uint8,
        )
        result_values[native_land] = np.clip(
            arguments.land_value - smoothed_ink[native_land],
            1,
            arguments.land_value,
        )
        result_values[~native_land] = 0

    result = Image.fromarray(result_values, mode="L")

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(arguments.output, optimize=True)

    if arguments.diagnostics:
        save_diagnostics(
            arguments.diagnostics,
            filled,
            accumulation,
            land,
            order,
        )

    river_pixels = int(
        np.count_nonzero(
            (np.asarray(result) > 0)
            & (np.asarray(result) < arguments.land_value - 4)
        ),
    )
    print(f"Heightmap:  {arguments.heightmap}")
    print(f"Output:     {arguments.output}")
    print(f"Analisi:    {analysis_width} x {analysis_height}")
    print(f"Soglia:     {arguments.min_basin_km2:g} km2")
    print(f"Pixel fiume:{river_pixels:,}")


if __name__ == "__main__":
    main()
