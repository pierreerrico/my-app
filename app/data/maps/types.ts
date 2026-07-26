import type { ReactNode } from "react";

export type GeographicPoint = {
  latitude: number;
  longitude: number;
};

export type MapBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export type MapFeatureKind =
  | "capital"
  | "city"
  | "town"
  | "village"
  | "port"
  | "forest"
  | "mountain"
  | "volcano"
  | "lake"
  | "river"
  | "ruin"
  | "monument"
  | "fortress"
  | "mine"
  | "landmark";

export type MapFeature = {
  id: string;
  name: string;
  kind: MapFeatureKind;
  position: GeographicPoint;
  description?: string;
  href?: string;
  elevationKm?: number;
  icon?: ReactNode;
};

export type MapRiverPoint =
  GeographicPoint & {
    /**
     * Elevazione puramente visuale sopra il terreno Three.js.
     * Non rappresenta necessariamente una quota geografica reale.
     */
    visualElevation?: number;
  };

export type MapRiver = {
  id: string;
  name?: string;
  points: MapRiverPoint[];
};

export type NationMapTextures = {
  diffuse: string;
  heightmap: string;
  landMask: string;
  normalMap?: string;

  riversMask?: string;
  routesMask?: string;

  coastDistance?: string;
  currentMap?: string;

  bathymetryMap: string;
  fogMap?: string;
};

export type Vector2Tuple =
  readonly [
    number,
    number,
  ];

export type Vector3Tuple =
  readonly [
    number,
    number,
    number,
  ];

export type NationMapSeaRendering = {
  /**
   * Normal map tileable principale.
   */
  normalMapA: string;

  /**
   * Seconda normal map tileable.
   *
   * Può anche essere una copia della prima:
   * viene campionata con scala, rotazione e
   * movimento differenti.
   */
  normalMapB: string;

  deepColor?: string;
  midColor?: string;
  shallowColor?: string;
  foamColor?: string;

  /**
   * Velocità complessiva dell’animazione.
   */
  surfaceSpeed?: number;

  /**
   * Intensità complessiva del rilievo ottico
   * e dell’illuminazione superficiale.
   */
  surfaceStrength?: number;

  /**
   * Ripetizione UV della prima normal map.
   */
  normalScaleA?: number;

  /**
   * Ripetizione UV della seconda normal map.
   */
  normalScaleB?: number;

  normalStrengthA?: number;
  normalStrengthB?: number;

  /**
   * Spostamento UV compiuto dalla normal map.
   * L’animazione viene comunque chiusa in loop
   * dallo shader.
   */
  normalSpeedA?: Vector2Tuple;
  normalSpeedB?: Vector2Tuple;

  /**
   * Rotazione in radianti delle due texture.
   */
  normalRotationA?: number;
  normalRotationB?: number;

  /**
   * Direzione della luce in coordinate mondo.
   */
  sunDirection?: Vector3Tuple;

  sunColor?: string;

  /**
   * Intensità e concentrazione del riflesso.
   */
  specularStrength?: number;
  specularPower?: number;

  /**
   * Riflesso crescente agli angoli radenti.
   */
  fresnelStrength?: number;
  fresnelPower?: number;

  /**
   * Creste luminose in mare aperto.
   */
  whitecapStrength?: number;
  whitecapThreshold?: number;

  /**
   * Estensione cromatica dell’acqua bassa.
   */
  coastWidth?: number;

  /**
   * Estensione delle fasce di schiuma.
   */
  foamWidth?: number;

  foamStrength?: number;
  foamScale?: number;
  foamSpeed?: number;
  foamBreakup?: number;
};

export type MapWorldExtensionMode =
  | "ocean"
  | "coastal"
  | "land"
  | "context"
  | "frame";

export type NationMapOceanHorizon = {
  /** Disattiva soltanto l'estensione procedurale, senza toccare il mare interno. */
  enabled?: boolean;
  /** Dimensione dell'oceano lontano rispetto al rettangolo cartografico. */
  extensionScale?: number;
  /** Ampiezza del raccordo, espressa come quota del lato minore della carta. */
  transitionWidth?: number;
  /** Profondità visuale del fondale esterno in unità Three.js. */
  seabedDrop?: number;
  deepWaterColor?: string;
  horizonColor?: string;
  mist?: {
    enabled?: boolean;
    /** `horizon` è il raccordo 2D economico; `volumetric` riattiva il raymarch. */
    mode?: "horizon" | "volumetric" | "off";
    density?: number;
    speed?: number;
  };
};

export type NationMapWorldExtension =
  NationMapOceanHorizon & {
    mode: MapWorldExtensionMode;
    /** Bianco = terra, nero = mare per le estensioni costiere. */
    edgeMask?: string;
    landColor?: string;
    contextColor?: string;
    desaturation?: number;
  };

export type MapPerformanceMode =
  | "auto"
  | "performance"
  | "balanced"
  | "quality";

export type NationMapPerformance = {
  mode?: MapPerformanceMode;
  maxDpr?: number;
  waterRenderTargetSize?: number;
  terrainSegments?: number;
  shadowMapSize?: 0 | 512 | 1024 | 2048;
  clouds?: boolean;
  pauseWhenHidden?: boolean;
};

export type NationMapPalette = {
  seaDeep: string;
  seaShallow: string;
  parchment: string;
  accent: string;
  background?: string;
};

export type HeightmapDefinition = {
  /**
   * Valore grayscale 0..255 corrispondente al livello del mare.
   *
   * pixel <= seaLevel: mare
   * pixel > seaLevel: terra
   */
  seaLevel: number;

  /**
   * Elevazione reale corrispondente al bianco puro della heightmap.
   */
  maximumElevationKm: number;
};

export type NationMapAnalysis = {
  /** Larghezza in pixel della heightmap analizzata. */
  imageWidthPx: number;

  /** Altezza in pixel della heightmap analizzata. */
  imageHeightPx: number;

  /** Numero totale di pixel analizzati. */
  totalPixels: number;

  /** Numero di pixel considerati terra. */
  landPixels: number;

  /** Numero di pixel considerati mare. */
  seaPixels: number;

  /** Soglia 8 bit usata come livello del mare. */
  seaLevel: number;

  /** Percentuale della carta occupata dalla terra, tra 0 e 1. */
  landCoverageRatio: number;

  /** Superficie totale del rettangolo cartografico. */
  mapAreaKm2: number;

  /** Superficie terrestre ricavata dalla heightmap. */
  territoryAreaKm2: number;
};

export type NationMapGeography = {
  /**
   * Larghezza reale dell’intera carta, mare compreso.
   */
  mapWidthKm: number;

  /**
   * Altezza reale dell’intera carta, mare compreso.
   */
  mapHeightKm: number;

  /**
   * Coordinata geografica corrispondente al pixel in alto a sinistra
   * della texture.
   */
  topLeft: GeographicPoint;

  /**
   * Raggio medio del pianeta.
   */
  planetRadiusKm: number;

  /**
   * Interpretazione fisica della heightmap.
   */
  heightmap: HeightmapDefinition;

  /**
   * Risultati generati dall’analisi offline della heightmap.
   */
  analysis?: NationMapAnalysis;
};

export type NationMapRendering = {
  /**
   * Altezza del piano nel mondo Three.js.
   * La larghezza viene derivata automaticamente dal rapporto della carta.
   */
  planeHeight?: number;

  /**
   * Esagerazione verticale applicata al rilievo.
   */
  elevationExaggeration?: number;

  /**
   * Risoluzione orizzontale della mesh.
   */
  segments?: number;
};

export type NationMapConfig = {
  id: string;
  title: string;
  subtitle?: string;

  geography: NationMapGeography;
  textures: NationMapTextures;
  palette: NationMapPalette;

  features?: MapFeature[];
  labels?: MapLabel[];

  rendering?: NationMapRendering;
  seaRendering?: NationMapSeaRendering;
  worldExtension?: NationMapWorldExtension;
  /** @deprecated usare worldExtension. */
  oceanHorizon?: NationMapOceanHorizon;
  performance?: NationMapPerformance;
};

export type DerivedMapGeometry = {
  /** Limiti geografici completi della texture. */
  bounds: MapBounds;

  /** Coordinata centrale derivata automaticamente. */
  center: GeographicPoint;

  /** Superficie dell’intero rettangolo cartografico. */
  mapAreaKm2: number;

  /** Superficie terrestre calcolata dalla heightmap. */
  territoryAreaKm2?: number;

  /** Quota della carta occupata dalla terra. */
  landCoverageRatio?: number;

  /** Dimensioni del piano Three.js. */
  planeWidth: number;
  planeHeight: number;

  /** Rapporto tra chilometri reali e unità Three.js. */
  kmPerPlaneUnit: number;

  /** Estensione geografica verticale della carta. */
  latitudeSpanDegrees: number;

  /** Estensione geografica orizzontale della carta. */
  longitudeSpanDegrees: number;
};

export type MapLabelKind =
  | "country"
  | "region"
  | "sea"
  | "mountainRange"
  | "river"
  | "district";

export type MapLabel = {
  id: string;
  text: string;
  position: GeographicPoint;
  kind: MapLabelKind;
  rotationDeg?: number;
  scale?: number;
};
