"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  TextureLoader,
  Vector2,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import type { ResolvedMapPerformance } from "./map-performance";
import {
  configureColorTexture,
  configureScalarTexture,
  configureTerrainNormalTexture,
} from "./map-texture-config";

export function MapTerrain({
  config,
  geometry,
  parchment,
  performance,
  onReady,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  performance: ResolvedMapPerformance;
  onReady?: () => void;
}) {
  const texturePaths = [
    config.textures.diffuse,
    config.textures.heightmap,
    config.textures.normalMap ??
      config.textures.heightmap,
    config.textures.landMask,
  ];

  const [
    surface,
    elevation,
    normal,
    landMask,
  ] = useLoader(
    TextureLoader,
    texturePaths,
  );

  const surfaceTexture = useMemo(
    () => configureColorTexture(surface),
    [surface],
  );

  const elevationTexture = useMemo(
    () => configureScalarTexture(elevation),
    [elevation],
  );

  const normalTexture = useMemo(
    () => configureTerrainNormalTexture(normal),
    [normal],
  );

  const landMaskTexture = useMemo(
    () => configureScalarTexture(landMask),
    [landMask],
  );

  const exaggeration =
    config.rendering?.elevationExaggeration ??
    2.5;

  /*
   * Altezza massima del rilievo convertita
   * da chilometri reali a unità Three.js.
   */
  const displacementScale =
    (
      config.geography.heightmap
        .maximumElevationKm /
      geometry.kmPerPlaneUnit
    ) *
    exaggeration;

  /*
   * Converte il livello del mare 0..255
   * nel corrispondente valore normalizzato 0..1.
   */
  const normalizedSeaLevel =
    config.geography.heightmap.seaLevel /
    255;

  /*
   * Porta il valore della heightmap corrispondente
   * al mare esattamente alla quota zero.
   *
   * displacement = textureValue × scale + bias
   *
   * Al livello del mare:
   *
   * seaLevel × scale + bias = 0
   *
   * quindi:
   *
   * bias = -seaLevel × scale
   */
  const displacementBias =
    -normalizedSeaLevel *
    displacementScale;

  const horizontalSegments =
    Math.min(
      config.rendering?.segments ??
        256,
      performance.terrainSegments,
    );

  const mapAspectRatio =
    geometry.planeWidth /
    geometry.planeHeight;

  const verticalSegments =
    Math.max(
      2,
      Math.round(
        horizontalSegments /
          mapAspectRatio,
      ),
    );

  const normalScale = useMemo(
    () => new Vector2(0.72, 0.72),
    [],
  );

  useEffect(() => {
    onReady?.();
  }, [
    elevationTexture,
    landMaskTexture,
    normalTexture,
    onReady,
    surfaceTexture,
  ]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={performance.shadowMapSize > 0}
      castShadow={performance.shadowMapSize > 0}
    >
      <planeGeometry
        args={[
          geometry.planeWidth,
          geometry.planeHeight,
          horizontalSegments,
          verticalSegments,
        ]}
      />

      <meshStandardMaterial
        map={
          parchment
            ? undefined
            : surfaceTexture
        }
        color={
          parchment
            ? config.palette.parchment
            : "#ffffff"
        }
        displacementMap={
          elevationTexture
        }
        displacementScale={
          displacementScale
        }
        displacementBias={
          displacementBias
        }
        normalMap={
          normalTexture
        }
        normalScale={normalScale}
        alphaMap={
          landMaskTexture
        }
        alphaTest={0.5}
        roughness={0.82}
        metalness={0}
      />
    </mesh>
  );
}
