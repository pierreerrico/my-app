"use client";

import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import type { ResolvedMapPerformance } from "./map-performance";
import { MapSea } from "./map-sea";
import { MapSeabed } from "./map-seabed";
import { MapWorldExtension } from "./map-world-extension";

/**
 * Composito oceanico completo. I suoi livelli sono mantenuti distinti
 * affinché superficie, fondale ed estensione condividano la stessa geometria.
 */
export function MapWater({
  config,
  geometry,
  parchment,
  performance,
  onReady,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  performance: ResolvedMapPerformance;
  onReady?: () => void;
}) {
  const currentMapPath =
    config.textures.currentMap;
  const coastDistancePath =
    config.textures.coastDistance;
  const landMaskPath =
    config.textures.landMask;
  const bathymetryMapPath =
    config.textures.bathymetryMap;
  if (
    !currentMapPath ||
    !coastDistancePath ||
    !landMaskPath ||
    !bathymetryMapPath
  ) {
    throw new Error(
      `La mappa "${config.id}" deve definire textures.currentMap, textures.coastDistance, textures.landMask e textures.bathymetryMap.`,
    );
  }

  const [
    currentMap,
    coastDistance,
    landMask,
    bathymetry,
  ] = useLoader(TextureLoader, [
    currentMapPath,
    coastDistancePath,
    landMaskPath,
    bathymetryMapPath,
  ]);

  return (
    <>
      <MapWorldExtension
        config={config}
        geometry={geometry}
        parchment={parchment}
      />

      <MapSeabed
        config={config}
        geometry={geometry}
        parchment={parchment}
        bathymetry={bathymetry}
        coastDistance={coastDistance}
        performance={performance}
      />

      <MapSea
        config={config}
        geometry={geometry}
        parchment={parchment}
        currentMap={currentMap}
        landMask={landMask}
        coastDistance={coastDistance}
        performance={performance}
        onReady={onReady}
      />
    </>
  );
}
