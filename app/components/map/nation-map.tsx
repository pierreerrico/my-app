"use client";

import { Canvas } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { PCFShadowMap } from "three";
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
  type ResolvedMapPerformance,
} from "./map-performance";

const FREE_VIEW_MIN_ZOOM = 0.08;

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
  const performance =
    useMemo<ResolvedMapPerformance>(
      () =>
        resolveMapPerformance(
          config,
        ),
      [config],
    );
  const [pageVisible, setPageVisible] =
    useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const zoomLevelRef = useRef(0);
  const staticViewAlignedRef = useRef(true);

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

    const closeWhenAtlasInfoOpens = () => {
      if (
        lorePage.classList.contains(
          "is-info-open",
        )
      ) {
        setSelectedFeature(null);
      }
    };
    const observer = new MutationObserver(
      closeWhenAtlasInfoOpens,
    );

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
      setProjectedMapRect(
        calculateProjectedMapRect(
          map.clientWidth,
          map.clientHeight,
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
    pinchDistanceRef.current =
      event.touches.length === 2 ? touchDistance(event.touches) : null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || pinchDistanceRef.current === null) return;
    const distance = touchDistance(event.touches);
    const previousDistance = pinchDistanceRef.current;
    pinchDistanceRef.current = distance;
    changeZoom((distance - previousDistance) * 0.008);
  }

  const visualZoomLevel = zoomLevel === 0 ? 0 : zoomLevel < 1.15 ? 1 : 2;

  return (
    <div
      ref={mapRef}
      className={`interactive-map zoom-level-${visualZoomLevel}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        pinchDistanceRef.current = null;
      }}
      data-map-id={config.id}
      data-map-width-km={config.geography.mapWidthKm}
      data-map-height-km={config.geography.mapHeightKm}
      data-territory-area-km2={geometry.territoryAreaKm2}
    >
      <div className="cartographic-sheet">
        <Canvas
          shadows={
            performance.shadowMapSize > 0
              ? {
                  type: PCFShadowMap,
                }
              : false
          }
          dpr={[
            1,
            performance.maxDpr,
          ]}
          frameloop={
            performance.pauseWhenHidden &&
            !pageVisible
              ? "never"
              : "always"
          }
          camera={{
            position: [0, 15.15, 0.01],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
          gl={{ antialias: true }}
          resize={{ debounce: { scroll: 0, resize: 0 } }}
        >
          <MapScene
            config={config}
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
            selectedFeatureId={
              selectedFeature?.id ?? null
            }
            onFeatureSelect={
              setSelectedFeature
            }
          />
        </Canvas>

        <div
          className="map-parchment-overlay"
          aria-hidden="true"
        />
        <NeoclassicalMapFrame />
        <MapTitle title={config.title} />
      </div>

      <MapFeatureSidebar
        feature={selectedFeature}
        onClose={() => {
          setSelectedFeature(null);
        }}
      />

      <div className="map-navigation-cluster">
        <CompassControl
          headingRadians={azimuth}
          onReset={() => setResetNorthSignal((value) => value + 1)}
        />
        <MapScale
          config={config}
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
