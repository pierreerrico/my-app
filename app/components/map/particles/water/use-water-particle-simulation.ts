"use client";

import {
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
} from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";

import { waterParticlePositionShader } from "./water-particle-position-shader";
import type {
  WaterParticleFrame,
  WaterParticleSimulationOptions,
  WaterParticleSimulationResult,
} from "./water-particle-types";
import { waterParticleVelocityShader } from "./water-particle-velocity-shader";

type ComputeVariable =
  ReturnType<
    GPUComputationRenderer[
      "addVariable"
    ]
  >;

export function useWaterParticleSimulation({
  landMask,
  currentMap,

  textureWidth = 128,
  textureHeight = 128,

  currentStrength = 0.035,
  currentResponse = 1.65,

  turbulenceStrength =
    0.0015,

  coastLookAhead = 2.4,

  coastSlideStrength =
    0.78,

  coastReflectionStrength =
    0.22,

  coastAvoidanceStrength =
    0.032,

  velocityDamping = 0.997,

  particleLifetime = 24,

  respawnCurrentThreshold =
    0.025,
}: WaterParticleSimulationOptions): WaterParticleSimulationResult {
  const renderer =
    useThree(
      (state) => state.gl,
    );

  const computeRef =
    useRef<GPUComputationRenderer | null>(
      null,
    );

  const positionVariableRef =
    useRef<ComputeVariable | null>(
      null,
    );

  const velocityVariableRef =
    useRef<ComputeVariable | null>(
      null,
    );

  const frameRef =
    useRef<WaterParticleFrame | null>(
      null,
    );

  const failedRef =
    useRef(false);

  useEffect(() => {
    failedRef.current =
      false;

    frameRef.current =
      null;

    const compute =
      new GPUComputationRenderer(
        textureWidth,
        textureHeight,
        renderer,
      );

    compute.setDataType(
      FloatType,
    );

    const initialPositionTexture =
      compute.createTexture();

    const initialVelocityTexture =
      compute.createTexture();

    initializePositionTexture(
      initialPositionTexture,
      textureWidth,
      textureHeight,
      particleLifetime,
    );

    initializeVelocityTexture(
      initialVelocityTexture,
      textureWidth,
      textureHeight,
    );

    const positionVariable =
      compute.addVariable(
        "textureWaterParticlePosition",
        waterParticlePositionShader,
        initialPositionTexture,
      );

    const velocityVariable =
      compute.addVariable(
        "textureWaterParticleVelocity",
        waterParticleVelocityShader,
        initialVelocityTexture,
      );

    compute.setVariableDependencies(
      positionVariable,
      [
        positionVariable,
        velocityVariable,
      ],
    );

    compute.setVariableDependencies(
      velocityVariable,
      [
        positionVariable,
        velocityVariable,
      ],
    );

    configureVariable(
      positionVariable,
    );

    configureVariable(
      velocityVariable,
    );

    positionVariable
      .material
      .uniforms
      .uLandMask = {
      value: landMask,
    };

    positionVariable
      .material
      .uniforms
      .uCurrentMap = {
      value: currentMap,
    };

    positionVariable
      .material
      .uniforms
      .uDeltaTime = {
      value: 0,
    };

    positionVariable
      .material
      .uniforms
      .uParticleLifetime = {
      value:
        particleLifetime,
    };

    positionVariable
      .material
      .uniforms
      .uRespawnCurrentThreshold = {
      value:
        respawnCurrentThreshold,
    };

    velocityVariable
      .material
      .uniforms
      .uLandMask = {
      value: landMask,
    };

    velocityVariable
      .material
      .uniforms
      .uCurrentMap = {
      value: currentMap,
    };

    velocityVariable
      .material
      .uniforms
      .uTime = {
      value: 0,
    };

    velocityVariable
      .material
      .uniforms
      .uDeltaTime = {
      value: 0,
    };

    velocityVariable
      .material
      .uniforms
      .uCurrentStrength = {
      value:
        currentStrength,
    };

    velocityVariable
      .material
      .uniforms
      .uCurrentResponse = {
      value:
        currentResponse,
    };

    velocityVariable
      .material
      .uniforms
      .uTurbulenceStrength = {
      value:
        turbulenceStrength,
    };

    velocityVariable
      .material
      .uniforms
      .uCoastLookAhead = {
      value:
        coastLookAhead,
    };

    velocityVariable
      .material
      .uniforms
      .uCoastSlideStrength = {
      value:
        coastSlideStrength,
    };

    velocityVariable
      .material
      .uniforms
      .uCoastReflectionStrength = {
      value:
        coastReflectionStrength,
    };

    velocityVariable
      .material
      .uniforms
      .uCoastAvoidanceStrength = {
      value:
        coastAvoidanceStrength,
    };

    velocityVariable
      .material
      .uniforms
      .uVelocityDamping = {
      value:
        velocityDamping,
    };

    const initializationError =
      compute.init();

    if (
      initializationError
    ) {
      console.error(
        "Errore durante l'inizializzazione della simulazione delle particelle oceaniche:",
        initializationError,
      );

      failedRef.current =
        true;

      compute.dispose();

      return;
    }

    computeRef.current =
      compute;

    positionVariableRef.current =
      positionVariable;

    velocityVariableRef.current =
      velocityVariable;

    frameRef.current = {
      positionTexture:
        compute
          .getCurrentRenderTarget(
            positionVariable,
          )
          .texture,

      velocityTexture:
        compute
          .getCurrentRenderTarget(
            velocityVariable,
          )
          .texture,
    };

    return () => {
      frameRef.current =
        null;

      positionVariableRef.current =
        null;

      velocityVariableRef.current =
        null;

      computeRef.current?.dispose();

      computeRef.current =
        null;
    };
  }, [
    coastAvoidanceStrength,
    coastLookAhead,
    coastReflectionStrength,
    coastSlideStrength,
    currentMap,
    currentResponse,
    currentStrength,
    landMask,
    particleLifetime,
    renderer,
    respawnCurrentThreshold,
    textureHeight,
    textureWidth,
    turbulenceStrength,
    velocityDamping,
  ]);

  useFrame(
    (state, deltaTime) => {
      const compute =
        computeRef.current;

      const positionVariable =
        positionVariableRef.current;

      const velocityVariable =
        velocityVariableRef.current;

      if (
        !compute ||
        !positionVariable ||
        !velocityVariable ||
        failedRef.current
      ) {
        return;
      }

      const safeDelta =
        Math.min(
          deltaTime,
          1 / 20,
        );

      positionVariable
        .material
        .uniforms
        .uDeltaTime
        .value =
        safeDelta;

      velocityVariable
        .material
        .uniforms
        .uDeltaTime
        .value =
        safeDelta;

      velocityVariable
        .material
        .uniforms
        .uTime
        .value =
        state.clock.elapsedTime;

      compute.compute();

      frameRef.current = {
        positionTexture:
          compute
            .getCurrentRenderTarget(
              positionVariable,
            )
            .texture,

        velocityTexture:
          compute
            .getCurrentRenderTarget(
              velocityVariable,
            )
            .texture,
      };
    },
  );

  const getFrame =
    useCallback(
      () =>
        frameRef.current,
      [],
    );

  return {
    getFrame,

    textureWidth,
    textureHeight,

    particleCount:
      textureWidth *
      textureHeight,
  };
}

function configureVariable(
  variable: ComputeVariable,
): void {
  variable.wrapS =
    ClampToEdgeWrapping;

  variable.wrapT =
    ClampToEdgeWrapping;

  variable.minFilter =
    NearestFilter;

  variable.magFilter =
    NearestFilter;
}

function initializePositionTexture(
  texture: DataTexture,
  width: number,
  height: number,
  particleLifetime: number,
): void {
  const data =
    texture.image.data;

  if (
    !(
      data instanceof
      Float32Array
    )
  ) {
    throw new Error(
      "La position texture delle particelle non usa Float32Array.",
    );
  }

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
      const index =
        (
          y * width +
          x
        ) * 4;

      data[index] =
        Math.random();

      data[index + 1] =
        Math.random();

      data[index + 2] =
        Math.random() *
        particleLifetime;

      data[index + 3] =
        Math.random();
    }
  }

  texture.needsUpdate =
    true;
}

function initializeVelocityTexture(
  texture: DataTexture,
  width: number,
  height: number,
): void {
  const data =
    texture.image.data;

  if (
    !(
      data instanceof
      Float32Array
    )
  ) {
    throw new Error(
      "La velocity texture delle particelle non usa Float32Array.",
    );
  }

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
      const index =
        (
          y * width +
          x
        ) * 4;

      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    }
  }

  texture.needsUpdate =
    true;
}