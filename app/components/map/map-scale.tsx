import type { CSSProperties } from "react";
import { chooseScaleDistance } from "../../data/maps/geography";
import { NationMapConfig } from "../../data/maps/types";

export function MapScale({
  config,
  projectedMapWidth,
}: {
  config: NationMapConfig;
  projectedMapWidth: number;
}) {
  const totalKm = chooseScaleDistance(config.geography.mapWidthKm);
  const renderedWidth = Math.max(
    72,
    projectedMapWidth *
      (totalKm /
        config.geography.mapWidthKm),
  );
  const majorDivisions = 3;
  const minorDivisions = 4;
  const stepKm = totalKm / majorDivisions;
  const width = 240;
  const startX = 10;
  const barY = 10;
  const barHeight = 8;
  const majorWidth = width / majorDivisions;
  const minorWidth = majorWidth / minorDivisions;

  return (
    <svg
      className="map-scale-ornament"
      viewBox="0 0 260 62"
      style={
        {
          "--map-scale-width": `${renderedWidth}px`,
        } as CSSProperties
      }
      aria-label={`Scala: ${totalKm} chilometri`}
    >
      <path
        className="scale-rail"
        d={`M${startX} ${barY}H${startX + width}`}
      />
      {Array.from({ length: minorDivisions }, (_, index) => (
        <rect
          className={index % 2 === 0 ? "is-dark" : "is-light"}
          key={`minor-${index}`}
          x={startX + minorWidth * index}
          y={barY}
          width={minorWidth}
          height={barHeight}
        />
      ))}
      {Array.from(
        { length: majorDivisions - 1 },
        (_, index) => {
          const majorIndex = index + 1;
          return (
            <rect
              className={majorIndex % 2 === 0 ? "is-dark" : "is-light"}
              key={`major-${majorIndex}`}
              x={startX + majorWidth * majorIndex}
              y={barY}
              width={majorWidth}
              height={barHeight}
            />
          );
        },
      )}
      {Array.from({ length: majorDivisions + 1 }, (_, index) => {
        const x = startX + majorWidth * index;
        return <path className="scale-tick" d={`M${x} ${barY}V34`} key={index} />;
      })}
      {Array.from({ length: majorDivisions + 1 }, (_, index) => {
        const x = startX + majorWidth * index;
        const value = Math.round(stepKm * index);
        return (
          <text
            key={index}
            x={x}
            y="56"
            textAnchor={
              index === 0
                ? "start"
                : index === majorDivisions
                  ? "end"
                  : "middle"
            }
          >
            {value}
          </text>
        );
      })}
    </svg>
  );
}
