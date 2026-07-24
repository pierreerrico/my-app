"use client";

import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import type { DerivedMapGeometry, MapRiver as MapRiverData, NationMapConfig } from "../../data/maps/types";
import { geographicPointToPlane } from "../../data/maps/geography";

export function MapRiver({
  river,
  config,
  geometry,
}: {
  river: MapRiverData;
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
}) {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        river.points.map((point) => {
          const [x, , z] = geographicPointToPlane(point, geometry);
          return new Vector3(x, (point.visualElevation ?? 0.04) + 0.035, z);
        }),
      ),
    [geometry, river.points],
  );

  return (
    <mesh>
      <tubeGeometry args={[curve, 64, 0.022, 6, false]} />
      <meshStandardMaterial
        color={config.palette.seaShallow}
        emissive={config.palette.seaDeep}
        emissiveIntensity={0.25}
        roughness={0.45}
      />
    </mesh>
  );
}