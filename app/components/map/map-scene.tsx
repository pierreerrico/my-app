"use client";

import { MapControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useRef,
} from "react";
import {
  MathUtils,
  MOUSE,
  TOUCH,
  Vector3,
} from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import { MapFeatureMarker } from "./map-feature-marker";
import { MapLoadingTerrain } from "./map-loading-terrain";
import { MapRiver } from "./map-river";
import { MapTerrain } from "./map-terrain";
import { MapWater } from "./map-water";

export function MapScene({
  config,
  geometry,
  zoomLevel,
  onRotationAvailable,
  resetNorthSignal,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  zoomLevel: number;
  onRotationAvailable: (
    available: boolean,
  ) => void;
  resetNorthSignal: number;
}) {
  const controls =
    useRef<MapControlsImpl>(null);

  const rotationAvailable =
    useRef(false);

  const recentering =
    useRef(false);

  useEffect(() => {
    if (
      !controls.current ||
      resetNorthSignal === 0
    ) {
      return;
    }

    recentering.current = true;
  }, [resetNorthSignal]);

  useFrame(({ camera, size }) => {
    if (!controls.current) {
      return;
    }

    const verticalFov =
      MathUtils.degToRad(45);

    const viewportAspect =
      Math.max(
        size.width /
          Math.max(size.height, 1),
        0.1,
      );

    const shortSide =
      Math.min(
        size.width,
        size.height,
      );

    const frameDepth =
      MathUtils.clamp(
        shortSide * 0.054,
        38,
        58,
      );

    const safeInset =
      frameDepth + 10;

    const usableWidth =
      Math.max(
        size.width -
          safeInset * 2,
        size.width * 0.5,
      );

    const usableHeight =
      Math.max(
        size.height -
          safeInset * 2,
        size.height * 0.5,
      );

    const usableWidthRatio =
      usableWidth /
      Math.max(size.width, 1);

    const usableHeightRatio =
      usableHeight /
      Math.max(size.height, 1);

    const fitMapHeight =
      geometry.planeHeight /
      (
        2 *
        Math.tan(
          verticalFov / 2,
        ) *
        usableHeightRatio
      );

    const fitMapWidth =
      geometry.planeWidth /
      (
        2 *
        Math.tan(
          verticalFov / 2,
        ) *
        viewportAspect *
        usableWidthRatio
      );

    const staticFitDistance =
      Math.max(
        fitMapHeight,
        fitMapWidth,
      ) * 1.02;

    const desiredDistances = [
      staticFitDistance,
      Math.max(
        staticFitDistance * 0.62,
        6.4,
      ),
      Math.max(
        staticFitDistance * 0.28,
        3.2,
      ),
    ];

    const desiredPolarAngles = [
      0.001,
      0.43,
      1.05,
    ];

    const currentDistance =
      controls.current.getDistance();

    const nextDistance =
      MathUtils.lerp(
        currentDistance,
        desiredDistances[
          zoomLevel
        ],
        0.095,
      );

    const currentPolar =
      controls.current
        .getPolarAngle();

    const nextPolar =
      MathUtils.lerp(
        currentPolar,
        desiredPolarAngles[
          zoomLevel
        ],
        0.095,
      );

    const offset =
      camera.position
        .clone()
        .sub(
          controls.current.target,
        )
        .setLength(nextDistance);

    camera.position
      .copy(
        controls.current.target,
      )
      .add(offset);

    const canRotate =
      zoomLevel === 2;

    controls.current.enableRotate =
      canRotate;

    controls.current.enablePan =
      zoomLevel > 0;

    controls.current.setPolarAngle(
      nextPolar,
    );

    if (!canRotate) {
      const azimuth =
        controls.current
          .getAzimuthalAngle();

      const shortestTurn =
        Math.atan2(
          Math.sin(-azimuth),
          Math.cos(-azimuth),
        );

      controls.current
        .setAzimuthalAngle(
          azimuth +
            shortestTurn *
              0.105,
        );
    }

    if (
      zoomLevel === 0 ||
      recentering.current
    ) {
      controls.current.target.lerp(
        new Vector3(
          0,
          0,
          0,
        ),
        0.095,
      );
    }

    const panLimits = [
      {
        x: 0,
        z: 0,
      },
      {
        x:
          geometry.planeWidth *
          0.26,
        z:
          geometry.planeHeight *
          0.22,
      },
      {
        x:
          geometry.planeWidth *
          0.43,
        z:
          geometry.planeHeight *
          0.38,
      },
    ][zoomLevel];

    const boundedTarget =
      controls.current
        .target
        .clone();

    boundedTarget.x =
      MathUtils.clamp(
        boundedTarget.x,
        -panLimits.x,
        panLimits.x,
      );

    boundedTarget.z =
      MathUtils.clamp(
        boundedTarget.z,
        -panLimits.z,
        panLimits.z,
      );

    const panCorrection =
      boundedTarget
        .clone()
        .sub(
          controls.current.target,
        );

    if (
      panCorrection.lengthSq() >
      0
    ) {
      controls.current.target.copy(
        boundedTarget,
      );

      camera.position.add(
        panCorrection,
      );
    }

    if (recentering.current) {
      const azimuth =
        controls.current
          .getAzimuthalAngle();

      const shortestTurn =
        Math.atan2(
          Math.sin(-azimuth),
          Math.cos(-azimuth),
        );

      controls.current
        .setAzimuthalAngle(
          azimuth +
            shortestTurn *
              0.105,
        );

      if (
        Math.abs(
          shortestTurn,
        ) < 0.002 &&
        controls.current.target
          .length() < 0.01
      ) {
        recentering.current =
          false;
      }
    }

    if (
      rotationAvailable.current !==
      canRotate
    ) {
      rotationAvailable.current =
        canRotate;

      onRotationAvailable(
        canRotate,
      );
    }
  });

  const background =
    config.palette.background ??
    config.palette.seaDeep;

  return (
    <>
      <color
        attach="background"
        args={[background]}
      />

      <fog
        attach="fog"
        args={[
          background,
          15,
          31,
        ]}
      />

      <ambientLight
        intensity={1.25}
      />

      <directionalLight
        castShadow
        position={[
          -6,
          10,
          5,
        ]}
        intensity={2.25}
        color="#ffe0ae"
      />

      <hemisphereLight
        args={[
          "#b8dbe0",
          "#785b3b",
          0.75,
        ]}
      />

      <Suspense fallback={null}>
        <MapWater
          config={config}
          geometry={geometry}
          parchment={
            zoomLevel === 0
          }
        />
      </Suspense>

      <Suspense
        fallback={
          <MapLoadingTerrain
            config={config}
            geometry={geometry}
          />
        }
      >
        <MapTerrain
          config={config}
          geometry={geometry}
          parchment={
            zoomLevel === 0
          }
        />
      </Suspense>

      {config.features.map(
        (feature) => (
          <MapFeatureMarker
            key={feature.id}
            feature={feature}
            config={config}
            geometry={geometry}
          />
        ),
      )}

      {zoomLevel > 0 &&
        config.rivers?.map(
          (river) => (
            <MapRiver
              key={river.id}
              river={river}
              config={config}
              geometry={geometry}
            />
          ),
        )}

      <MapControls
        ref={controls}
        makeDefault
        enablePan
        enableRotate={false}
        enableZoom={false}
        minDistance={3.2}
        maxDistance={Math.max(
          15.4,
          geometry.planeWidth *
            1.2,
        )}
        minPolarAngle={0.001}
        maxPolarAngle={1.075}
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning={
          false
        }
        mouseButtons={{
          LEFT: MOUSE.PAN,
          MIDDLE:
            MOUSE.DOLLY,
          RIGHT:
            MOUSE.ROTATE,
        }}
        touches={{
          ONE: TOUCH.PAN,
          TWO:
            TOUCH.DOLLY_ROTATE,
        }}
        target={[
          0,
          0,
          0,
        ]}
      />
    </>
  );
}