"use client";

import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import { MapSea } from "./map-sea";
import { MapSeabed } from "./map-seabed";
import { MapOceanHorizon } from "./map-ocean-horizon";

/**
 * Composito oceanico della mappa.
 *
 * MapSeabed:
 * - bathymetryMap -> displacement del fondale;
 * - coastDistance -> colore del fondale.
 *
 * MapSea:
 * - currentMap -> direzione delle normali Water2 e moto locale della foam;
 * - coastDistance -> equivalente della profondità costiera nel port tuxalin;
 * - landMask -> impedisce alla foam di comparire sulla terra;
 * - texture fotografiche MIT -> struttura organica della foam.
 */
export function MapWater({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const currentMapPath =
    config.textures.currentMap;

  const bathymetryMapPath =
    config.textures.bathymetryMap;

  const coastDistancePath =
    config.textures.coastDistance;

  const landMaskPath =
    config.textures.landMask;

  if (
    !currentMapPath ||
    !bathymetryMapPath ||
    !coastDistancePath ||
    !landMaskPath
  ) {
    throw new Error(
      `La mappa "${config.id}" deve definire textures.currentMap, textures.bathymetryMap, textures.coastDistance e textures.landMask.`,
    );
  }

  const [
    currentMap,
    bathymetry,
    coastDistance,
    landMask,
  ] = useLoader(
    TextureLoader,
    [
      currentMapPath,
      bathymetryMapPath,
      coastDistancePath,
      landMaskPath,
    ],
  );

  return (
    <>
      <MapOceanHorizon
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
      />

      <MapSea
        config={config}
        geometry={geometry}
        parchment={parchment}
        currentMap={currentMap}
        landMask={landMask}
        coastDistance={coastDistance}
      />
    </>
  );
}
