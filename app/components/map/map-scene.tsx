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
  MapFeature,
  NationMapConfig,
} from "../../data/maps/types";
import { MapEdgeFog } from "./map-edge-fog";
import { MapFeatureMarker } from "./map-feature-marker";
import { MapLoadingTerrain } from "./map-loading-terrain";
import { MapWater } from "./map-water";
import { MapSkybox } from "./map-skybox";
import { MapTerrain } from "./map-terrain";
import { MapWorldGrid } from "./map-world-grid";
import type { ResolvedMapPerformance } from "./map-performance";
import { resolveStaticMapFit } from "./map-camera-fit";

export function MapScene({
  config,
  geometry,
  zoomLevel,
  onAzimuthChange,
  onStaticAlignmentChange,
  resetNorthSignal,
  northStepSignal,
  performance,
  selectedFeatureId,
  onFeatureSelect,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  zoomLevel: number;
  onAzimuthChange: (azimuth: number) => void;
  onStaticAlignmentChange: (aligned: boolean) => void;
  resetNorthSignal: number;
  northStepSignal: number;
  performance: ResolvedMapPerformance;
  selectedFeatureId: string | null;
  onFeatureSelect: (feature: MapFeature) => void;
}) {
  const controls =
    useRef<MapControlsImpl>(null);

  const reportedAzimuth =
    useRef(0);
  const reportedStaticAlignment =
    useRef(true);

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

  useEffect(() => {
    if (!controls.current || northStepSignal === 0) {
      return;
    }

    const azimuth = controls.current.getAzimuthalAngle();
    const turnToNorth = Math.atan2(
      Math.sin(-azimuth),
      Math.cos(-azimuth),
    );
    const correction = Math.min(
      Math.abs(turnToNorth),
      MathUtils.clamp(Math.abs(turnToNorth) * 0.48, 0.04, 0.26),
    );
    const nextAzimuth =
      Math.abs(turnToNorth) <= 0.025
        ? 0
        : azimuth + Math.sign(turnToNorth) * correction;

    controls.current.setAzimuthalAngle(nextAzimuth);

    const previousTarget = controls.current.target.clone();
    if (controls.current.target.length() <= 0.025) {
      controls.current.target.set(0, 0, 0);
    } else {
      controls.current.target.multiplyScalar(0.52);
    }
    controls.current.object.position.add(
      controls.current.target.clone().sub(previousTarget),
    );

    reportedAzimuth.current = nextAzimuth;
    onAzimuthChange(nextAzimuth);
  }, [northStepSignal, onAzimuthChange]);

  useFrame(({ camera, size }) => {
    if (!controls.current) {
      return;
    }
    

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

    const staticFit = resolveStaticMapFit({
      viewportWidth: size.width,
      viewportHeight: size.height,
      usableWidth,
      usableHeight,
      planeWidth: geometry.planeWidth,
      planeHeight: geometry.planeHeight,
    });
    const staticFitDistance =
      staticFit.distance;
    const staticVisibleWidth =
      usableWidth /
      staticFit.pixelsPerPlaneUnit;
    const staticVisibleHeight =
      usableHeight /
      staticFit.pixelsPerPlaneUnit;
    const staticPanLimits = {
      x: Math.max(
        0,
        (
          geometry.planeWidth -
          staticVisibleWidth
        ) / 2,
      ),
      z: Math.max(
        0,
        (
          geometry.planeHeight -
          staticVisibleHeight
        ) / 2,
      ),
    };
    const staticPanEnabled =
      staticPanLimits.x > 0.01 ||
      staticPanLimits.z > 0.01;

    const zoom = MathUtils.clamp(zoomLevel, 0, 2);
    const zoomStage = Math.min(Math.floor(zoom), 1);
    const zoomStageProgress = zoom - zoomStage;
    const desiredDistances = [
      staticFitDistance,
      Math.max(
        staticFitDistance * 0.62,
        6.4,
      ),
      3.2,
    ];

    const desiredPolarAngles = [
      0.001,
      0.43,
      1.05,
    ];

    const desiredDistance = MathUtils.lerp(
      desiredDistances[zoomStage],
      desiredDistances[zoomStage + 1],
      zoomStageProgress,
    );
    const desiredPolarAngle = MathUtils.lerp(
      desiredPolarAngles[zoomStage],
      desiredPolarAngles[zoomStage + 1],
      zoomStageProgress,
    );

    const currentDistance =
      controls.current.getDistance();

    const nextDistance =
      MathUtils.lerp(
        currentDistance,
        desiredDistance,
        0.095,
      );

    const currentPolar =
      controls.current
        .getPolarAngle();

    const nextPolar =
      MathUtils.lerp(
        currentPolar,
        desiredPolarAngle,
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
      zoom > 0.02;

    controls.current.enableRotate =
      canRotate;

    controls.current.enablePan =
      zoom > 0.02 ||
      staticPanEnabled;

    controls.current.setPolarAngle(
      nextPolar,
    );

    if (zoom === 0) {
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
      (
        zoom === 0 &&
        !staticPanEnabled
      ) ||
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

    const panLimitStages = [
      staticPanLimits,
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
    ];
    const panLimits = {
      x: MathUtils.lerp(
        panLimitStages[zoomStage].x,
        panLimitStages[zoomStage + 1].x,
        zoomStageProgress,
      ),
      z: MathUtils.lerp(
        panLimitStages[zoomStage].z,
        panLimitStages[zoomStage + 1].z,
        zoomStageProgress,
      ),
    };

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

    const azimuth =
      controls.current
        .getAzimuthalAngle();

    const azimuthDelta =
      Math.atan2(
        Math.sin(
          azimuth -
            reportedAzimuth.current,
        ),
        Math.cos(
          azimuth -
            reportedAzimuth.current,
        ),
      );

    if (
      Math.abs(azimuthDelta) >
      0.003
    ) {
      reportedAzimuth.current =
        azimuth;
      onAzimuthChange(azimuth);
    }

    const staticViewAligned =
      Math.abs(
        Math.atan2(
          Math.sin(azimuth),
          Math.cos(azimuth),
        ),
      ) <= 0.008 &&
      controls.current.target.length() <= 0.025;

    if (staticViewAligned !== reportedStaticAlignment.current) {
      reportedStaticAlignment.current = staticViewAligned;
      onStaticAlignmentChange(staticViewAligned);
    }
  });

  const parchment =
    zoomLevel === 0;

  const background =
    parchment
      ? "#b5a88f"
      : config.palette.background ??
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
        castShadow={
          performance.shadowMapSize >
          0
        }
        shadow-mapSize={[
          Math.max(
            performance.shadowMapSize,
            512,
          ),
          Math.max(
            performance.shadowMapSize,
            512,
          ),
        ]}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
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

      <MapSkybox
        config={config}
        geometry={geometry}
        parchment={parchment}
      />

      <Suspense fallback={null}>
        <MapWater
          config={config}
          geometry={geometry}
          parchment={parchment}
          performance={performance}
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
          parchment={parchment}
          performance={performance}
        />
      </Suspense>

      {config.features
        ? config.features.map(
            (feature) => (
              <MapFeatureMarker
                key={feature.id}
                feature={feature}
                config={config}
                geometry={geometry}
                selected={
                  selectedFeatureId ===
                  feature.id
                }
                staticMode={zoomLevel === 0}
                onSelect={onFeatureSelect}
              />
            ),
          )
        : null}

      <MapEdgeFog
        config={config}
        geometry={geometry}
        parchment={parchment}
        performance={performance}
      />

      <MapWorldGrid
        geometry={geometry}
        visible={parchment}
      />

      <MapControls
        ref={controls}
        makeDefault
        enablePan
        enableRotate={zoomLevel > 0.02}
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
