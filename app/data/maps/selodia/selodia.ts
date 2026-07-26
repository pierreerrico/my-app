import analysis from "../generated/selodia-analysis.json";
import source from "./selodia-source.json";
import { selodiaFeatures } from "./selodia.features";
import { selodiaLabels } from "./selodia.labels";
import type {
  NationMapAnalysis,
  NationMapConfig,
} from "../types";

const selodiaAnalysis =
  analysis as NationMapAnalysis;

export const selodiaMap:
  NationMapConfig = {
  id: "selodia",
  title: "Arcontato di Selodia",
  subtitle:
    "Tavola geografica tridimensionale",

  geography: {
    mapWidthKm:
      source.mapWidthKm,

    mapHeightKm:
      source.mapHeightKm,

    topLeft:
      source.topLeft,

    planetRadiusKm:
      source.planetRadiusKm,

    heightmap: {
      seaLevel:
        source.heightmap.seaLevel,

      maximumElevationKm:
        source.heightmap
          .maximumElevationKm,
    },

    analysis:
      selodiaAnalysis.totalPixels > 0
        ? selodiaAnalysis
        : undefined,
  },

  textures: {
    diffuse:
      "/maps/selodia/selodia-atlas.png",

    heightmap:
      source.heightmap.publicUrl,

    landMask:
      source.generatedLandMask
        .publicUrl,

    normalMap:
      "/maps/selodia/selodia-normal.png",

    coastDistance:
      "/maps/selodia/selodia-coast-distance.png",

    riversMask:
      "/maps/selodia/selodia-rivers-mask.png",

    routesMask:
      "/maps/selodia/selodia-routes-mask.png",
    
    currentMap: "/maps/selodia/selodia-current.png",

    bathymetryMap: "/maps/selodia/selodia-bathymetry.png",

    fogMap: "/maps/selodia/selodia-fog-mask.png",
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

  seaRendering: {
    normalMapA:
      "/maps/shared/water-normal-a.jpg",

    normalMapB:
      "/maps/shared/water-normal-b.jpg",

    /*
     * Palette più chiara e più vicina
     * al riferimento illustrato.
     */
    deepColor: "#10566c",
    midColor: "#16778a",
    shallowColor: "#28a5a5",
    foamColor: "#eef8f3",

    surfaceSpeed: 0.62,
    surfaceStrength: 0.82,

    /*
     * Onde leggermente più larghe:
     * meno effetto tessitura fotografica.
     */
    normalScaleA: 10,
    normalScaleB: 24,

    normalStrengthA: 0.72,
    normalStrengthB: 0.42,

    normalSpeedA: [
      0.85,
      0.32,
    ],

    normalSpeedB: [
      -0.46,
      0.78,
    ],

    normalRotationA: 0.08,
    normalRotationB: 1.13,

    /*
     * Luce meno calda e meno diretta.
     */
    sunDirection: [
      0.36,
      0.84,
      0.4,
    ],

    sunColor: "#e7f4ee",

    /*
     * Riflessi larghi e tenui.
     */
    specularStrength: 0.46,
    specularPower: 24,

    fresnelStrength: 0.32,
    fresnelPower: 2.7,

    /*
     * Whitecaps decorative e morbide.
     */
    whitecapStrength: 0.58,
    whitecapThreshold: 0.48,

    coastWidth: 0.42,

    /*
     * Foam più spessa, più lenta
     * e meno finemente granulosa.
     */
    foamWidth: 0.24,
    foamStrength: 1.75,
    foamScale: 72,
    foamSpeed: 0.56,
    foamBreakup: 0.42,
  },

  /*
   * Estensione procedurale generica: il mare cartografico conserva shader,
   * correnti e schiuma, mentre l'orizzonte economico impedisce di vedere la
   * fine della carta durante la navigazione prospettica.
   */
  worldExtension: {
    mode: "ocean",
    extensionScale: 30,
    transitionWidth: 0.14,
    seabedDrop: 2.6,
    mist: {
      mode: "horizon",
      density: 0.44,
      speed: 0.02,
    },
  },

  /*
   * `auto` seleziona un profilo in base a viewport, DPR, memoria e core.
   * I singoli valori restano sovrascrivibili per una mappa particolare.
   */
  performance: {
    mode: "auto",
    pauseWhenHidden: true,
    textures: {
      diffuse:
        "/maps/selodia/selodia-atlas-performance.png",
      heightmap:
        "/maps/selodia/selodia-heightmap-performance.png",
      landMask:
        "/maps/selodia/selodia-land-mask-performance.png",
      normalMap:
        "/maps/selodia/selodia-normal-performance.png",
      coastDistance:
        "/maps/selodia/selodia-coast-distance-performance.png",
      bathymetryMap:
        "/maps/selodia/selodia-bathymetry-performance.png",
      fogMap:
        "/maps/selodia/selodia-fog-mask-performance.png",
    },
  },

  features:
    selodiaFeatures,

  labels:
    selodiaLabels,
};
