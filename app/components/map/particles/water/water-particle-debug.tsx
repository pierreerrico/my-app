"use client";

import {
  useFrame,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
} from "three";

import {
  waterParticleDebugFragmentShader,
  waterParticleDebugVertexShader,
} from "./water-particle-debug-material";
import type {
  WaterParticleDebugProps,
} from "./water-particle-types";

export function WaterParticleDebug({
  simulation,
  geometry,
  enabled = true,
  pointSize = 2.4,
  opacity = 0.84,
  surfaceOffset = 0.032,
}: WaterParticleDebugProps) {
  const materialRef =
    useRef<ShaderMaterial>(null);

  const lookupGeometry =
    useMemo(
      () =>
        createParticleLookupGeometry(
          simulation.textureWidth,
          simulation.textureHeight,
        ),
      [
        simulation.textureHeight,
        simulation.textureWidth,
      ],
    );

  const emptyPositionTexture =
    useMemo(
      () =>
        createEmptyTexture(),
      [],
    );

  const emptyVelocityTexture =
    useMemo(
      () =>
        createEmptyTexture(),
      [],
    );

  const uniforms =
    useMemo(
      () => ({
        uPositionTexture: {
          value:
            emptyPositionTexture,
        },

        uVelocityTexture: {
          value:
            emptyVelocityTexture,
        },

        uPlaneSize: {
          value:
            new Vector2(
              geometry.planeWidth,
              geometry.planeHeight,
            ),
        },

        uSurfaceOffset: {
          value:
            surfaceOffset,
        },

        uPointSize: {
          value:
            pointSize,
        },

        uOpacity: {
          value:
            opacity,
        },
      }),
      [
        emptyPositionTexture,
        emptyVelocityTexture,
        geometry.planeHeight,
        geometry.planeWidth,
        opacity,
        pointSize,
        surfaceOffset,
      ],
    );

  useFrame(() => {
    const material =
      materialRef.current;

    if (!material) {
      return;
    }

    const frame =
      simulation.getFrame();

    if (!frame) {
      return;
    }

    material.uniforms
      .uPositionTexture
      .value =
      frame.positionTexture;

    material.uniforms
      .uVelocityTexture
      .value =
      frame.velocityTexture;
  });

  useEffect(
    () => () => {
      lookupGeometry.dispose();

      emptyPositionTexture.dispose();

      emptyVelocityTexture.dispose();
    },
    [
      emptyPositionTexture,
      emptyVelocityTexture,
      lookupGeometry,
    ],
  );

  if (!enabled) {
    return null;
  }

  return (
    <points
      geometry={
        lookupGeometry
      }
      frustumCulled={false}
      renderOrder={30}
    >
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={
          waterParticleDebugVertexShader
        }
        fragmentShader={
          waterParticleDebugFragmentShader
        }
        transparent
        depthTest
        depthWrite={false}
        blending={
          AdditiveBlending
        }
      />
    </points>
  );
}

function createParticleLookupGeometry(
  width: number,
  height: number,
): BufferGeometry {
  const particleCount =
    width * height;

  const positions =
    new Float32Array(
      particleCount * 3,
    );

  const particleUvs =
    new Float32Array(
      particleCount * 2,
    );

  let particleIndex =
    0;

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      const uvIndex =
        particleIndex * 2;

      particleUvs[uvIndex] =
        (
          x + 0.5
        ) / width;

      particleUvs[
        uvIndex + 1
      ] =
        (
          y + 0.5
        ) / height;

      particleIndex += 1;
    }
  }

  const lookupGeometry =
    new BufferGeometry();

  lookupGeometry.setAttribute(
    "position",
    new BufferAttribute(
      positions,
      3,
    ),
  );

  lookupGeometry.setAttribute(
    "particleUv",
    new BufferAttribute(
      particleUvs,
      2,
    ),
  );

  lookupGeometry.computeBoundingSphere();

  return lookupGeometry;
}

function createEmptyTexture(): DataTexture {
  const texture =
    new DataTexture(
      new Float32Array([
        0,
        0,
        0,
        0,
      ]),
      1,
      1,
      RGBAFormat,
      FloatType,
    );

  texture.minFilter =
    NearestFilter;

  texture.magFilter =
    NearestFilter;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}