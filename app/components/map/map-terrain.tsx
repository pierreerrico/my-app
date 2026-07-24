"use client";

import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import {
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";

export function MapTerrain({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
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

  const surfaceTexture = useMemo(() => {
    const texture = surface.clone();

    texture.colorSpace =
      SRGBColorSpace;

    texture.minFilter =
      LinearFilter;

    texture.needsUpdate =
      true;

    return texture;
  }, [surface]);

  const elevationTexture = useMemo(() => {
    const texture = elevation.clone();

    texture.minFilter =
      LinearFilter;

    texture.needsUpdate =
      true;

    return texture;
  }, [elevation]);

  const normalTexture = useMemo(() => {
    const texture = normal.clone();

    texture.minFilter =
      LinearFilter;

    texture.needsUpdate =
      true;

    return texture;
  }, [normal]);

  const landMaskTexture = useMemo(() => {
    const texture = landMask.clone();

    texture.minFilter =
      LinearFilter;

    texture.needsUpdate =
      true;

    return texture;
  }, [landMask]);

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
    config.rendering?.segments ??
    256;

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

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      castShadow
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
        normalScale={
          new Vector2(0.72, 0.72)
        }
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