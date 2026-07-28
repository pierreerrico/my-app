"use client";

import {
  AnimatePresence,
  motion,
} from "motion/react";
import type { CSSProperties } from "react";
import { NationMapConfig } from "../../data/maps/types";

export function MapScale({
  config,
  projectedMapWidth,
  zoomLevel,
}: {
  config: NationMapConfig;
  projectedMapWidth: number;
  zoomLevel: number;
}) {
  const perspectiveMagnification =
    zoomLevel <= 1
      ? 1 + zoomLevel * 0.62
      : 1.62 + (zoomLevel - 1) * 1.58;
  const apparentMapWidth =
    projectedMapWidth * perspectiveMagnification;
  const staticDistance =
    choosePerspectiveScaleDistance(
      config.geography.mapWidthKm,
      projectedMapWidth,
    );
  const totalKm =
    choosePerspectiveScaleDistance(
      config.geography.mapWidthKm,
      apparentMapWidth,
    );
  const renderedWidth = Math.max(
    96,
    projectedMapWidth *
      (staticDistance /
        config.geography.mapWidthKm),
  );
  const majorDivisions = 4;
  const minorDivisions = 4;
  const segmentCount =
    4 + Math.round(zoomLevel * 2);
  const stepKm = totalKm / majorDivisions;
  const viewBoxWidth = 260;
  const width = 228;
  const startX = 16;
  const barY = 12;
  const barHeight = 7;
  const majorWidth = width / majorDivisions;
  const segmentWidth =
    width / segmentCount;
  const minorWidth =
    majorWidth / minorDivisions;
  const majorValues = Array.from(
    { length: majorDivisions + 1 },
    (_, index) => Math.round(stepKm * index),
  );

  return (
    <svg
      className="map-scale-ornament"
      viewBox={`0 0 ${viewBoxWidth} 54`}
      style={
        {
          "--map-scale-width": `${renderedWidth}px`,
        } as CSSProperties
      }
      aria-label={`Scala: ${totalKm} chilometri`}
    >
      <defs>
        <clipPath id="map-scale-segment-clip">
          <rect
            x={startX}
            y={barY}
            width={width}
            height={barHeight}
          />
        </clipPath>
      </defs>

      <path
        className="scale-ornament-line"
        d={`M${startX} 5H${startX + width}`}
      />
      <circle className="scale-ornament-node" cx={startX} cy="5" r="2" />
      <circle
        className="scale-ornament-node"
        cx={startX + width}
        cy="5"
        r="2"
      />

      <g
        className="scale-bar"
        clipPath="url(#map-scale-segment-clip)"
      >
        <AnimatePresence initial={false}>
          {Array.from({ length: segmentCount }, (_, index) => (
            <ScaleSegment
              key={`segment-${index}`}
              x={startX + segmentWidth * index}
              y={barY}
              width={segmentWidth}
              height={barHeight}
              dark={index % 2 === 0}
            />
          ))}
        </AnimatePresence>
      </g>

      <rect
        className="scale-outline"
        x={startX}
        y={barY}
        width={width}
        height={barHeight}
      />

      <AnimatePresence initial={false}>
        {majorValues.map((value, index) => {
          const x = startX + majorWidth * index;

          return (
            <motion.g
              className="scale-major-mark"
              key={`${index}-${value}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.24 }}
            >
              <path d={`M${x} ${barY - 3}V${barY + barHeight + 4}`} />
              <text
                x={x}
                y="46"
                textAnchor={
                  index === 0
                    ? "start"
                    : index === majorDivisions
                      ? "end"
                      : "middle"
                }
              >
                {index === majorDivisions ? `${value} km` : value}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {Array.from({ length: minorDivisions - 1 }, (_, index) => {
        const x =
          startX +
          minorWidth *
            (index + 1);

        return (
          <path
            className="scale-minor-mark"
            d={`M${x} ${barY}V${barY + barHeight}`}
            key={x}
          />
        );
      })}
    </svg>
  );
}

function ScaleSegment({
  x,
  y,
  width,
  height,
  dark,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  dark: boolean;
}) {
  return (
    <motion.rect
      className={`scale-segment ${dark ? "is-dark" : "is-light"}`}
      initial={{
        opacity: 0,
      }}
      animate={{
        x,
        width,
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        x: {
          duration: 0.34,
          ease: [0.22, 0.8, 0.2, 1],
        },
        width: {
          duration: 0.34,
          ease: [0.22, 0.8, 0.2, 1],
        },
        opacity: {
          duration: 0.2,
        },
      }}
      x={x}
      y={y}
      width={width}
      height={height}
    />
  );
}

function choosePerspectiveScaleDistance(
  mapWidthKm: number,
  apparentMapWidth: number,
): number {
  const targetWidth = 144;
  const rawInterval =
    (mapWidthKm * targetWidth) /
    Math.max(apparentMapWidth, 1) /
    4;
  const intervalMultiple =
    rawInterval <= 10 ? 5 : 10;
  const interval = Math.max(
    5,
    Math.ceil(
      rawInterval /
        intervalMultiple,
    ) * intervalMultiple,
  );

  return interval * 4;
}
