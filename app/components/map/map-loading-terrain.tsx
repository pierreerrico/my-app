"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";
import type { DerivedMapGeometry, NationMapConfig } from "../../data/maps/types";

export function MapLoadingTerrain({
  config,
  geometry,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = config.palette.parchment;
      context.fillRect(0, 0, 2, 2);
    }
    return new CanvasTexture(canvas);
  }, [config.palette.parchment]);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[geometry.planeWidth, geometry.planeHeight]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}