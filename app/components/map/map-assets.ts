import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

import type { NationMapConfig } from "../../data/maps/types";
import {
  resolvePerformanceMapConfig,
  type ResolvedMapPerformance,
} from "./map-performance";

const SHARED_WATER_TEXTURES = [
  "/maps/shared/foam.png",
  "/maps/shared/foam-shore.png",
] as const;

function resolveSecondNormalMap(firstPath: string): string {
  const derived = firstPath.replace(
    /water-normal-a(?=\.[a-z0-9]+$)/i,
    "water-normal-b",
  );

  return derived === firstPath
    ? "/maps/shared/water-normal-b.jpg"
    : derived;
}

export function collectMapAssetPaths(
  config: NationMapConfig,
  performance: ResolvedMapPerformance,
): string[] {
  const runtimeConfig = resolvePerformanceMapConfig(
    config,
    performance,
  );
  const paths = new Set<string>();

  const textureCandidates = [
    runtimeConfig.textures.diffuse,
    runtimeConfig.textures.heightmap,
    runtimeConfig.textures.normalMap,
    runtimeConfig.textures.landMask,
    runtimeConfig.textures.currentMap,
    runtimeConfig.textures.bathymetryMap,
    runtimeConfig.textures.coastDistance,
  ];

  for (const path of textureCandidates) {
    if (typeof path === "string" && path.length > 0) {
      paths.add(path);
    }
  }

  const mistMode =
    runtimeConfig.worldExtension?.mist?.mode ??
    runtimeConfig.oceanHorizon?.mist?.mode ??
    "horizon";
  if (
    mistMode === "volumetric" ||
    performance.clouds
  ) {
    const fogMap =
      runtimeConfig.textures.fogMap ??
      runtimeConfig.textures.landMask;
    if (fogMap) paths.add(fogMap);
  }

  const sea = runtimeConfig.seaRendering;
  if (sea) {
    paths.add(sea.normalMapA);
    paths.add(
      sea.normalMapB ?? resolveSecondNormalMap(sea.normalMapA),
    );
    for (const path of SHARED_WATER_TEXTURES) {
      paths.add(path);
    }
  }

  const extension =
    runtimeConfig.worldExtension ??
    runtimeConfig.oceanHorizon;
  if (
    extension &&
    "edgeMask" in extension &&
    typeof extension.edgeMask === "string"
  ) {
    paths.add(extension.edgeMask);
  }

  return [...paths];
}

/**
 * Avvia il caricamento nel cache layer di R3F prima di montare il Canvas.
 * In questo modo i loader usati dalla scena riutilizzano le stesse promise e
 * il browser non aspetta il primo render WebGL per iniziare le richieste.
 */
export function preloadMapAssets(
  config: NationMapConfig,
  performance: ResolvedMapPerformance,
): void {
  if (typeof window === "undefined") return;

  const paths = collectMapAssetPaths(config, performance);
  if (paths.length === 0) return;

  useLoader.preload(TextureLoader, paths);
}
