"use client";

import { Canvas } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { PCFSoftShadowMap } from "three";
import type { NationMapConfig } from "../../data/maps/";
import { deriveMapGeometry } from "../../data/maps/geography";
import NeoclassicalMapFrame from "./neoclassical-map-frame";
import { CompassControl } from "./map-controls";
import { MapGrid } from "./map-grid";
import { MapScale } from "./map-scale";
import { MapScene } from "./map-scene";
import { MapTitle } from "./map-title";

export default function NationMap({ config }: { config: NationMapConfig }) {
  const geometry = useMemo(() => deriveMapGeometry(config), [config]);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [rotationAvailable, setRotationAvailable] = useState(false);
  const [resetNorthSignal, setResetNorthSignal] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const lorePage = map?.closest(".nation-lore-page");
    if (!lorePage) return;

    const resetToStatic = () => {
      setZoomLevel(0);
      setResetNorthSignal((value) => value + 1);
    };
    lorePage.addEventListener("nation-map-reset-static", resetToStatic);
    return () => {
      lorePage.removeEventListener("nation-map-reset-static", resetToStatic);
    };
  }, []);

  function changeZoom(amount: number) {
    setZoomLevel((level) => Math.min(2, Math.max(0, level + amount)));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
    changeZoom(-event.deltaY * unit * 0.0025);
  }

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
      onWheel={handleWheel}
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
          shadows={{ type: PCFSoftShadowMap }}
          dpr={[1, 1.6]}
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
            onRotationAvailable={setRotationAvailable}
            resetNorthSignal={resetNorthSignal}
          />
        </Canvas>

        <NeoclassicalMapFrame />
        <MapGrid geometry={geometry} />
        <MapTitle title={config.title} />
        <MapScale config={config} />
      </div>

      {rotationAvailable && (
        <CompassControl
          onReset={() => setResetNorthSignal((value) => value + 1)}
        />
      )}
    </div>
  );
}

function touchDistance(touches: React.TouchList): number {
  const first = touches.item(0);
  const second = touches.item(1);
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  );
}
