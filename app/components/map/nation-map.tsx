"use client";

import { Canvas } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";
import { PCFSoftShadowMap } from "three";
import type {
  MapFeature,
  NationMapConfig,
} from "../../data/maps/";
import { deriveMapGeometry } from "../../data/maps/geography";
import NeoclassicalMapFrame from "./neoclassical-map-frame";
import { CompassControl } from "./map-controls";
import { MapScale } from "./map-scale";
import { MapScene } from "./map-scene";
import { MapTitle } from "./map-title";
import { MapFeatureSidebar } from "./map-feature-sidebar";
import { resolveStaticMapFit } from "./map-camera-fit";
import {
  resolveMapPerformance,
  resolvePerformanceMapConfig,
  type ResolvedMapPerformance,
} from "./map-performance";
import { preloadMapAssets } from "./map-assets";
import { MapRenderScheduler } from "./map-render-scheduler";
import "./map-runtime.css";

const FREE_VIEW_MIN_ZOOM = 0.08;
type MapReadyPart = "terrain" | "water" | "atmosphere";

const useClientLayoutEffect =
  typeof window === "undefined"
    ? useEffect
    : useLayoutEffect;

export default function NationMap({ config }: { config: NationMapConfig }) {
  const geometry = useMemo(() => deriveMapGeometry(config), [config]);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [azimuth, setAzimuth] = useState(0);
  const [projectedMapRect, setProjectedMapRect] =
    useState<ProjectedMapRect>({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
  const [resetNorthSignal, setResetNorthSignal] = useState(0);
  const [northStepSignal, setNorthStepSignal] = useState(0);
  const [selectedFeature, setSelectedFeature] =
    useState<MapFeature | null>(null);
  const [performance, setPerformance] =
    useState<ResolvedMapPerformance | null>(
      null,
    );
  const [sceneAssetsReady, setSceneAssetsReady] =
    useState(false);
  const [canvasReady, setCanvasReady] =
    useState(false);
  const [prewarming, setPrewarming] =
    useState(true);
  const readyPartsRef = useRef<Set<MapReadyPart>>(
    new Set(),
  );
  const runtimeConfig = useMemo(
    () =>
      performance
        ? resolvePerformanceMapConfig(
            config,
            performance,
          )
        : config,
    [config, performance],
  );
  const requiredReadyParts = useMemo<MapReadyPart[]>(() => {
    const mistMode =
      runtimeConfig.worldExtension?.mist?.mode ??
      runtimeConfig.oceanHorizon?.mist?.mode ??
      "horizon";
    const needsAtmosphere =
      mistMode === "volumetric" ||
      Boolean(performance?.clouds);

    return needsAtmosphere
      ? ["terrain", "water", "atmosphere"]
      : ["terrain", "water"];
  }, [performance?.clouds, runtimeConfig]);
  const [pageVisible, setPageVisible] =
    useState(true);
  const [atlasActive, setAtlasActive] =
    useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);
  const zoomLevelRef = useRef(0);
  const staticViewAlignedRef = useRef(true);

  useClientLayoutEffect(() => {
    /*
     * La modalità automatica viene risolta dopo l'idratazione ma prima del
     * primo paint utile. Il preload parte prima del mount del Canvas e i
     * loader della scena riutilizzano le stesse richieste/cache.
     */
    const resolved = resolveMapPerformance(config);
    preloadMapAssets(config, resolved);
    readyPartsRef.current.clear();
    setSelectedFeature(null);
    setSceneAssetsReady(false);
    setCanvasReady(false);
    setPrewarming(true);
    setPerformance(resolved);
  }, [config]);

  function commitZoomLevel(level: number) {
    const nextLevel = Math.min(2, Math.max(0, level));
    zoomLevelRef.current = nextLevel;
    setZoomLevel(nextLevel);
  }

  useEffect(() => {
    const map = mapRef.current;
    const lorePage = map?.closest(".nation-lore-page");
    if (!lorePage) return;

    const resetToStatic = () => {
      commitZoomLevel(0);
      setResetNorthSignal((value) => value + 1);
    };
    lorePage.addEventListener("nation-map-reset-static", resetToStatic);
    return () => {
      lorePage.removeEventListener("nation-map-reset-static", resetToStatic);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lorePage =
      map?.closest(".nation-lore-page");

    if (!lorePage) return;

    const syncLorePageState = () => {
      setAtlasActive(
        lorePage.classList.contains(
          "is-atlas-active",
        ),
      );

      if (
        lorePage.classList.contains(
          "is-info-open",
        )
      ) {
        setSelectedFeature(null);
      }
    };
    const observer = new MutationObserver(
      syncLorePageState,
    );

    syncLorePageState();
    observer.observe(lorePage, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateProjectedMapRect = () => {
      const width = map.clientWidth;
      const height = map.clientHeight;

      setProjectedMapRect(
        calculateProjectedMapRect(
          width,
          height,
          geometry.planeWidth,
          geometry.planeHeight,
        ),
      );
    };
    updateProjectedMapRect();
    const observer = new ResizeObserver(
      updateProjectedMapRect,
    );
    observer.observe(map);

    return () => {
      observer.disconnect();
    };
  }, [
    geometry.planeHeight,
    geometry.planeWidth,
  ]);

  useEffect(() => {
    const updateVisibility = () => {
      setPageVisible(
        document.visibilityState ===
          "visible",
      );
    };
    updateVisibility();
    document.addEventListener(
      "visibilitychange",
      updateVisibility,
    );
    return () => {
      document.removeEventListener(
        "visibilitychange",
        updateVisibility,
      );
    };
  }, []);

  useEffect(() => {
    if (!performance || canvasReady) return;

    const fallback = window.setTimeout(() => {
      setPrewarming(false);
      setCanvasReady(true);
    }, 12000);

    return () => {
      window.clearTimeout(fallback);
    };
  }, [canvasReady, performance]);

  function changeZoom(amount: number) {
    const currentLevel = zoomLevelRef.current;
    const nextLevel = Math.min(2, Math.max(0, currentLevel + amount));

    if (amount > 0) {
      commitZoomLevel(nextLevel);
      return;
    }

    if (
      !staticViewAlignedRef.current &&
      nextLevel <= FREE_VIEW_MIN_ZOOM
    ) {
      commitZoomLevel(FREE_VIEW_MIN_ZOOM);
      setNorthStepSignal((value) => value + 1);
      return;
    }

    commitZoomLevel(nextLevel);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleWheel = (
      event: globalThis.WheelEvent,
    ) => {
      event.preventDefault();

      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? 120
            : 1;
      const amount =
        -event.deltaY * unit * 0.0025;
      const currentLevel =
        zoomLevelRef.current;
      const nextLevel = Math.min(
        2,
        Math.max(
          0,
          currentLevel + amount,
        ),
      );

      if (
        amount < 0 &&
        !staticViewAlignedRef.current &&
        nextLevel <= FREE_VIEW_MIN_ZOOM
      ) {
        commitZoomLevel(
          FREE_VIEW_MIN_ZOOM,
        );
        setNorthStepSignal(
          (value) => value + 1,
        );
        return;
      }

      commitZoomLevel(nextLevel);
    };

    map.addEventListener(
      "wheel",
      handleWheel,
      { passive: false },
    );

    return () => {
      map.removeEventListener(
        "wheel",
        handleWheel,
      );
    };
  }, []);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = {
      distance: touchDistance(event.touches),
      zoom: zoomLevelRef.current,
    };
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (
      event.touches.length !== 2 ||
      pinchRef.current === null
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const distance = touchDistance(event.touches);
    const distanceDelta =
      distance - pinchRef.current.distance;
    const nextLevel = Math.min(
      2,
      Math.max(
        0,
        pinchRef.current.zoom +
          distanceDelta / 140,
      ),
    );

    if (
      distanceDelta < 0 &&
      !staticViewAlignedRef.current &&
      nextLevel <= FREE_VIEW_MIN_ZOOM
    ) {
      commitZoomLevel(FREE_VIEW_MIN_ZOOM);
      setNorthStepSignal((value) => value + 1);
      return;
    }

    commitZoomLevel(nextLevel);
  }

  const markScenePartReady = useCallback(
    (part: MapReadyPart) => {
      if (readyPartsRef.current.has(part)) return;

      readyPartsRef.current.add(part);
      const allReady = requiredReadyParts.every(
        (requiredPart) =>
          readyPartsRef.current.has(requiredPart),
      );

      if (allReady) {
        setSceneAssetsReady(true);
      }
    },
    [requiredReadyParts],
  );

  const handleCanvasReady = useCallback(() => {
    /*
     * La scena dinamica è stata compilata mentre il Canvas era coperto. Ora
     * torniamo alla tavola statica e la lasciamo renderizzare prima del fade.
     */
    setPrewarming(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setCanvasReady(true);
      });
    });
  }, []);

  const visualZoomLevel = zoomLevel === 0 ? 0 : zoomLevel < 1.15 ? 1 : 2;

  return (
    <div
      ref={mapRef}
      className={`interactive-map zoom-level-${visualZoomLevel}${canvasReady ? " is-map-ready" : ""}`}
      aria-busy={!canvasReady}
      style={
        {
          "--map-loading-parchment": config.palette.parchment,
          "--map-loading-accent": config.palette.accent,
        } as CSSProperties
      }
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        pinchRef.current = null;
      }}
      onTouchCancel={() => {
        pinchRef.current = null;
      }}
      data-map-id={config.id}
      data-map-width-km={config.geography.mapWidthKm}
      data-map-height-km={config.geography.mapHeightKm}
      data-territory-area-km2={geometry.territoryAreaKm2}
    >
      <div className="cartographic-sheet">
        <div
          className="map-atlas-surface map-atlas-reveal"
          aria-hidden={!canvasReady}
        >
          {performance ? <Canvas
          shadows={
            performance.shadowMapSize > 0
              ? {
                  type: PCFSoftShadowMap,
                }
              : false
          }
          dpr={[
            1,
            performance.maxDpr,
          ]}
          frameloop="demand"
          camera={{
            position: [0, 15.15, 0.01],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: performance.antialias,
            alpha: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
          }}
          resize={{ debounce: { scroll: 0, resize: 0 } }}
        >
          <MapRenderScheduler
            active={
              atlasActive &&
              (
                !performance.pauseWhenHidden ||
                pageVisible
              )
            }
            assetsReady={sceneAssetsReady}
            targetFps={
              zoomLevel === 0
                ? performance.staticFps
                : performance.targetFps
            }
            prewarmFrames={performance.prewarmFrames}
            onReady={handleCanvasReady}
          />
          <MapScene
            config={runtimeConfig}
            geometry={geometry}
            zoomLevel={zoomLevel}
            onAzimuthChange={setAzimuth}
            onStaticAlignmentChange={(
              aligned,
            ) => {
              staticViewAlignedRef.current =
                aligned;
            }}
            resetNorthSignal={resetNorthSignal}
            northStepSignal={northStepSignal}
            performance={performance}
            prewarming={prewarming}
            onReadyPart={markScenePartReady}
            selectedFeatureId={
              selectedFeature?.id ?? null
            }
            onFeatureSelect={
              setSelectedFeature
            }
          />
        </Canvas> : (
          <div
            className="map-canvas-loading"
            role="status"
            aria-label="Caricamento dell’atlante"
          />
        )}

          <div
            className="map-parchment-overlay"
            aria-hidden="true"
          />
        </div>

        <div
          className="map-prerender-cover"
          role="status"
          aria-live="polite"
          aria-label="Caricamento dell’atlante"
          aria-hidden={canvasReady}
        >
          <div className="map-prerender-circle" aria-hidden="true">
            <span className="map-prerender-ring" />
            <svg
              className="map-prerender-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 5 19 18H5L12 5Z" />
            </svg>
          </div>
          <span className="map-prerender-label">
            Caricando l’atlante…
          </span>
        </div>

        <NeoclassicalMapFrame />
        <MapTitle title={config.title} />
      </div>

      <MapFeatureSidebar
        feature={selectedFeature}
        onClose={() => {
          setSelectedFeature(null);
        }}
      />

      <div
        className="map-navigation-cluster map-atlas-reveal"
        aria-hidden={!canvasReady}
      >
        <CompassControl
          headingRadians={azimuth}
          onReset={() => setResetNorthSignal((value) => value + 1)}
        />
        <MapScale
          config={runtimeConfig}
          projectedMapWidth={projectedMapRect.width}
        />
      </div>

    </div>
  );
}

type ProjectedMapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};


function calculateProjectedMapRect(
  viewportWidth: number,
  viewportHeight: number,
  planeWidth: number,
  planeHeight: number,
): ProjectedMapRect {
  const shortSide = Math.min(
    viewportWidth,
    viewportHeight,
  );
  const frameDepth = Math.min(
    58,
    Math.max(38, shortSide * 0.054),
  );
  const safeInset = frameDepth + 10;
  const usableWidth = Math.max(
    viewportWidth - safeInset * 2,
    viewportWidth * 0.5,
  );
  const usableHeight = Math.max(
    viewportHeight - safeInset * 2,
    viewportHeight * 0.5,
  );
  const { pixelsPerPlaneUnit } = resolveStaticMapFit({
    viewportWidth,
    viewportHeight,
    usableWidth,
    usableHeight,
    planeWidth,
    planeHeight,
  });
  const width =
    planeWidth * pixelsPerPlaneUnit;
  const height =
    planeHeight * pixelsPerPlaneUnit;

  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
  };
}

function touchDistance(touches: React.TouchList): number {
  const first = touches.item(0);
  const second = touches.item(1);
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  );
}
