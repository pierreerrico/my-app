"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  DirectionalLight,
  Object3D,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import type { ResolvedMapPerformance } from "./map-performance";
import { getEquinoxNoonSunDirection } from "./map-solar-position";

export function MapLighting({
  config,
  geometry,
  performance,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  performance: ResolvedMapPerformance;
}) {
  const light = useRef<DirectionalLight>(null);
  const target = useRef<Object3D>(null);

  const shadowVolume = useMemo(() => {
    const exaggeration =
      config.rendering?.elevationExaggeration ?? 2.5;
    const maximumTerrainHeight =
      (
        config.geography.heightmap.maximumElevationKm /
        geometry.kmPerPlaneUnit
      ) * exaggeration;
    const mapRadius =
      Math.hypot(
        geometry.planeWidth,
        geometry.planeHeight,
      ) * 0.5;
    const radius =
      mapRadius + maximumTerrainHeight;
    const lightDistance =
      Math.max(24, radius * 3);

    return {
      radius,
      lightDistance,
      far: lightDistance + radius * 2,
    };
  }, [
    config.geography.heightmap.maximumElevationKm,
    config.rendering?.elevationExaggeration,
    geometry.kmPerPlaneUnit,
    geometry.planeHeight,
    geometry.planeWidth,
  ]);

  const sunPosition = useMemo(
    () =>
      getEquinoxNoonSunDirection(geometry)
        .multiplyScalar(shadowVolume.lightDistance)
        .toArray(),
    [geometry, shadowVolume.lightDistance],
  );

  useLayoutEffect(() => {
    if (!light.current || !target.current) {
      return;
    }

    light.current.target = target.current;
    light.current.target.updateMatrixWorld();
    light.current.shadow.camera.updateProjectionMatrix();
  }, [shadowVolume]);

  const shadowsEnabled =
    performance.shadowMapSize > 0;

  return (
    <>
      <ambientLight intensity={0.42} />

      <hemisphereLight
        args={[
          "#b8dbe0",
          "#785b3b",
          0.28,
        ]}
      />

      <object3D ref={target} position={[0, 0, 0]} />

      <directionalLight
        ref={light}
        position={sunPosition}
        color="#fff0c7"
        intensity={2.2}
        castShadow={shadowsEnabled}
        shadow-mapSize={[
          Math.max(performance.shadowMapSize, 512),
          Math.max(performance.shadowMapSize, 512),
        ]}
        shadow-camera-near={0.1}
        shadow-camera-far={shadowVolume.far}
        shadow-camera-left={-shadowVolume.radius}
        shadow-camera-right={shadowVolume.radius}
        shadow-camera-top={shadowVolume.radius}
        shadow-camera-bottom={-shadowVolume.radius}
        shadow-bias={-0.0001}
        shadow-normalBias={0.012}
      />
    </>
  );
}
