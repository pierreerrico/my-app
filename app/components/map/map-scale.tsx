import { chooseScaleDistance } from "../../data/maps/geography";
import { NationMapConfig } from "../../data/maps/types";

export function MapScale({ config }: { config: NationMapConfig }) {
  const totalKm = chooseScaleDistance(config.geography.mapWidthKm);
  const divisions = 4;
  const stepKm = totalKm / divisions;
  const width = 200;
  const startX = 10;
  const y = 18;

  return (
    <svg className="map-scale-ornament" viewBox="0 0 220 52" aria-label={`Scala: ${totalKm} chilometri`}>
      <path d={`M${startX} ${y}H${startX + width}`} />
      {Array.from({ length: divisions + 1 }, (_, index) => {
        const x = startX + (width / divisions) * index;
        return <path d={`M${x} 12V26`} key={index} />;
      })}
      <path d={`M${startX} 32H${startX + width}`} />
      {Array.from({ length: divisions + 1 }, (_, index) => {
        const x = startX + (width / divisions) * index;
        const value = Math.round(stepKm * index);
        return (
          <text
            key={index}
            x={x}
            y="47"
            textAnchor={index === 0 ? "start" : index === divisions ? "end" : "middle"}
          >
            {index === divisions ? `${value} km` : value}
          </text>
        );
      })}
    </svg>
  );
}
