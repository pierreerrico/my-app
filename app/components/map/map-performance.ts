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
  },
  balanced: {
    mode: "balanced",
    maxDpr: 1.35,
    waterRenderTargetSize: 512,
    terrainSegments: 192,
    shadowMapSize: 1024,
    clouds: true,
    pauseWhenHidden: true,
  },
  quality: {
    mode: "quality",
    maxDpr: 1.6,
    waterRenderTargetSize: 768,
    terrainSegments: 256,
    shadowMapSize: 2048,
    clouds: true,
    pauseWhenHidden: true,
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
  const narrow =
    Math.min(
      window.innerWidth,
      window.innerHeight,
    ) < 720;

  if (
    narrow ||
    memory <= 4 ||
    cores <= 4
  ) {
    return "performance";
  }

  if (
    memory >= 12 &&
    cores >= 10 &&
    window.devicePixelRatio <= 2
  ) {
    return "quality";
  }

  return "balanced";
}
