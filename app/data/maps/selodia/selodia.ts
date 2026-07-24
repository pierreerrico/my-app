import analysis from "../generated/selodia-analysis.json";
import source from "./selodia-source.json";
import { selodiaFeatures } from "./selodia.features";
import { selodiaLabels } from "./selodia.labels";
import type { NationMapAnalysis, NationMapConfig } from "../types";

const selodiaAnalysis = analysis as NationMapAnalysis;

export const selodiaMap: NationMapConfig = {
  id: "selodia",
  title: "Arcontato di Selodia",
  subtitle: "Tavola geografica tridimensionale",

  geography: {
    mapWidthKm: source.mapWidthKm,
    mapHeightKm: source.mapHeightKm,
    topLeft: source.topLeft,
    planetRadiusKm: source.planetRadiusKm,
    heightmap: {
      seaLevel: source.heightmap.seaLevel,
      maximumElevationKm: source.heightmap.maximumElevationKm,
    },
    analysis:
      selodiaAnalysis.totalPixels > 0
        ? selodiaAnalysis
        : undefined,
  },

  textures: {
    diffuse: "/maps/selodia/selodia-atlas.png",
    heightmap: source.heightmap.publicUrl,
    landMask: source.generatedLandMask.publicUrl,
    normalMap: "/maps/selodia/selodia-normal.png",

    riversMask: "/maps/selodia/selodia-rivers-mask.png",
    routesMask: "/maps/selodia/selodia-routes-mask.png",
  },

  palette: {
    seaDeep: "#123f55",
    seaShallow: "#2d8792",
    parchment: "#d8c8a9",
    accent: "#a87534",
    background: "#102f3d",
  },

  rendering: {
    planeHeight: 9.9,
    elevationExaggeration: 2.85,
    segments: 256,
  },

  features: selodiaFeatures,
  labels: selodiaLabels,
};