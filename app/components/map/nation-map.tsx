"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
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
  const lastWheel = useRef(0);

  function changeZoom(direction: 1 | -1) {
    const now = Date.now();
    if (now - lastWheel.current < 320) return;
    lastWheel.current = now;
    setZoomLevel((level) => Math.min(2, Math.max(0, level + direction)));
  }

  return (
    <div
      className={`interactive-map zoom-level-${zoomLevel}`}
      onWheel={(event) => {
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 1 : -1);
      }}
      data-map-id={config.id}
      data-map-width-km={config.geography.mapWidthKm}
      data-map-height-km={config.geography.mapHeightKm}
      data-territory-area-km2={geometry.estimatedTerritoryAreaKm2}
    >
      <div className="cartographic-sheet">
        <Canvas
          shadows
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
