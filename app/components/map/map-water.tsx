"use client";

import {
  useLoader,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
} from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  Texture,
  TextureLoader,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import { MapSea } from "./map-sea";
import { useWaterParticleSimulation } from "./particles/water/use-water-particle-simulation";
import { WaterParticleDebug } from "./particles/water/water-particle-debug";

const WATER_PARTICLE_DEBUG =
  false;

type MapWaterProps = {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
};

type MapWaterContentProps =
  MapWaterProps & {
    currentMapPath: string;
  };

export function MapWater({
  config,
  geometry,
  parchment,
}: MapWaterProps) {
  const currentMapPath =
    config.textures.currentMap;

  if (!currentMapPath) {
    throw new Error(
      `La mappa "${config.id}" non definisce textures.currentMap.`,
    );
  }

  return (
    <MapWaterContent
      config={config}
      geometry={geometry}
      parchment={parchment}
      currentMapPath={
        currentMapPath
      }
    />
  );
}

function MapWaterContent({
  config,
  geometry,
  parchment,
  currentMapPath,
}: MapWaterContentProps) {
  const [
    landMaskSource,
    currentMapSource,
  ] = useLoader(
    TextureLoader,
    [
      config.textures.landMask,
      currentMapPath,
    ],
  );

  const landMaskTexture =
    useMemo(
      () =>
        createLandMaskTexture(
          landMaskSource,
        ),
      [landMaskSource],
    );

  const currentMapTexture =
    useMemo(
      () =>
        createCurrentMapTexture(
          currentMapSource,
        ),
      [currentMapSource],
    );

  useEffect(
    () => () => {
      landMaskTexture.dispose();
      currentMapTexture.dispose();
    },
    [
      currentMapTexture,
      landMaskTexture,
    ],
  );

  const simulation =
    useWaterParticleSimulation({
      landMask:
        landMaskTexture,

      currentMap:
        currentMapTexture,

      textureWidth: 128,
      textureHeight: 128,

      /*
       * Moltiplicatore globale della velocità.
       *
       * La direzione e l’intensità locale
       * arrivano dalla current map.
       */
      currentStrength:
        0.035,

      turbulenceStrength:
        0.0015,

      currentResponse:
        1.65,

      coastLookAhead:
        2.4,

      coastSlideStrength:
        0.78,

      coastReflectionStrength:
        0.22,

      coastAvoidanceStrength:
        0.032,

      velocityDamping:
        0.997,

      particleLifetime:
        24,

      respawnCurrentThreshold:
        0.025,
    });

  return (
    <>
      <MapSea
        config={config}
        geometry={geometry}
        parchment={parchment}
        currentMap={currentMapTexture}
      />

      <WaterParticleDebug
        simulation={
          simulation
        }
        geometry={geometry}
        enabled={
          WATER_PARTICLE_DEBUG &&
          !parchment
        }
        pointSize={2.4}
        opacity={0.84}
        surfaceOffset={0.032}
      />
    </>
  );
}

function createLandMaskTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  texture.colorSpace =
    NoColorSpace;

  texture.wrapS =
    ClampToEdgeWrapping;

  texture.wrapT =
    ClampToEdgeWrapping;

  texture.minFilter =
    NearestFilter;

  texture.magFilter =
    NearestFilter;

  texture.generateMipmaps =
    false;

  texture.flipY =
    source.flipY;

  texture.needsUpdate =
    true;

  return texture;
}

function createCurrentMapTexture(
  source: Texture,
): Texture {
  const texture =
    source.clone();

  /*
   * È una texture di dati, non un’immagine
   * da interpretare nello spazio colore sRGB.
   */
  texture.colorSpace =
    NoColorSpace;

  texture.wrapS =
    ClampToEdgeWrapping;

  texture.wrapT =
    ClampToEdgeWrapping;

  /*
   * La current map rappresenta un campo
   * vettoriale continuo: qui vogliamo
   * interpolazione morbida.
   */
  texture.minFilter =
    LinearFilter;

  texture.magFilter =
    LinearFilter;

  texture.generateMipmaps =
    false;

  /*
   * Deve usare lo stesso orientamento
   * verticale della land mask.
   */
  texture.flipY =
    source.flipY;

  texture.needsUpdate =
    true;

  return texture;
}