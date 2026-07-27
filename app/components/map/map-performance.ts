import type {
  MapPerformanceMode,
  NationMapConfig,
} from "../../data/maps/types";

export type ResolvedMapPerformance = {
  mode: Exclude<MapPerformanceMode, "auto">;
  maxDpr: number;
  waterRenderTargetSize: number;
  terrainSegments: number;
  shadowMapSize: 0 | 512 | 1024 | 2048;
  clouds: boolean;
  pauseWhenHidden: boolean;
  targetFps: number;
  staticFps: number;
  antialias: boolean;
  prewarmFrames: number;
};

const PRESETS: Record<
  ResolvedMapPerformance["mode"],
  ResolvedMapPerformance
> = {
  performance: {
    mode: "performance",
    maxDpr: 1,
    waterRenderTargetSize: 256,
    terrainSegments: 112,
    shadowMapSize: 0,
    clouds: false,
    pauseWhenHidden: true,
    targetFps: 30,
    staticFps: 12,
    antialias: false,
    prewarmFrames: 2,
  },
  balanced: {
    mode: "balanced",
    maxDpr: 1.25,
    waterRenderTargetSize: 448,
    terrainSegments: 176,
    shadowMapSize: 512,
    clouds: false,
    pauseWhenHidden: true,
    targetFps: 45,
    staticFps: 18,
    antialias: true,
    prewarmFrames: 3,
  },
  quality: {
    mode: "quality",
    maxDpr: 1.5,
    waterRenderTargetSize: 640,
    terrainSegments: 224,
    shadowMapSize: 1024,
    clouds: true,
    pauseWhenHidden: true,
    targetFps: 60,
    staticFps: 24,
    antialias: true,
    prewarmFrames: 4,
  },
};

export function resolveMapPerformance(
  config: NationMapConfig,
): ResolvedMapPerformance {
  const requestedMode =
    config.performance?.mode ?? "auto";
  const mode =
    requestedMode === "auto"
      ? detectAutomaticMode()
      : requestedMode;
  const preset = PRESETS[mode];

  return {
    ...preset,
    maxDpr:
      config.performance?.maxDpr ??
      preset.maxDpr,
    waterRenderTargetSize:
      config.performance
        ?.waterRenderTargetSize ??
      preset.waterRenderTargetSize,
    terrainSegments:
      config.performance
        ?.terrainSegments ??
      preset.terrainSegments,
    shadowMapSize:
      config.performance?.shadowMapSize ??
      preset.shadowMapSize,
    clouds:
      config.performance?.clouds ??
      preset.clouds,
    pauseWhenHidden:
      config.performance?.pauseWhenHidden ??
      preset.pauseWhenHidden,
  };
}

export function resolvePerformanceMapConfig(
  config: NationMapConfig,
  performance: ResolvedMapPerformance,
): NationMapConfig {
  const performanceTextures =
    config.performance?.textures;

  if (
    performance.mode !== "performance" ||
    !performanceTextures
  ) {
    return config;
  }

  return {
    ...config,
    textures: {
      ...config.textures,
      ...performanceTextures,
    },
  };
}

function detectAutomaticMode():
  ResolvedMapPerformance["mode"] {
  if (typeof window === "undefined") {
    return "balanced";
  }

  const navigatorWithMemory =
    navigator as Navigator & {
      deviceMemory?: number;
    };
  const memory =
    navigatorWithMemory.deviceMemory ?? 8;
  const cores =
    navigator.hardwareConcurrency ?? 8;
  const coarsePointer = window.matchMedia(
    "(pointer: coarse)",
  ).matches;
  const narrowViewport =
    window.innerWidth < 760;
  const compactTouchDevice =
    coarsePointer &&
    Math.min(
      window.innerWidth,
      window.innerHeight,
    ) < 920;

  if (
    narrowViewport ||
    compactTouchDevice ||
    memory <= 4 ||
    cores <= 4
  ) {
    return "performance";
  }

  if (
    window.innerWidth >= 1440 &&
    memory >= 8 &&
    cores >= 10 &&
    window.devicePixelRatio <= 1.75
  ) {
    return "quality";
  }

  return "balanced";
}
