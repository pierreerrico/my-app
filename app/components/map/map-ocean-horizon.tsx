"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";

const DEFAULT_EXTENSION_SCALE = 6;
const DEFAULT_TRANSITION_WIDTH = 0.12;
const DEFAULT_SEABED_DROP = 2.4;

const horizonVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const oceanFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uDeepColor;
  uniform vec3 uHorizonColor;
  uniform float uTime;
  uniform float uExtensionScale;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  void main() {
    vec2 centred = abs(vUv - 0.5) * 2.0;
    float mapBoundary =
      max(centred.x, centred.y) * uExtensionScale;
    if (mapBoundary < 0.985) {
      discard;
    }
    float distanceFromMap = mapBoundary;
    float distanceBlend = smoothstep(1.0, uExtensionScale, distanceFromMap);

    vec2 wavePosition =
      vWorldPosition.xz * 0.52 +
      vec2(uTime * 0.018, -uTime * 0.011);
    float broadWave =
      sin(wavePosition.x + sin(wavePosition.y * 0.73)) * 0.5 + 0.5;
    float fineWave =
      hash21(floor(wavePosition * 2.4)) * 0.12;

    vec3 color = mix(uDeepColor, uHorizonColor, distanceBlend * 0.58);
    color += (broadWave * 0.025 + fineWave * 0.018) *
      (1.0 - distanceBlend * 0.55);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const mistFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uMistColor;
  uniform vec3 uSeamColor;
  uniform float uTime;
  uniform float uInnerRatio;
  uniform float uTransition;
  uniform float uDensity;
  uniform float uSpeed;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float noise21(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
      mix(
        hash21(cell + vec2(0.0, 1.0)),
        hash21(cell + vec2(1.0, 1.0)),
        local.x
      ),
      local.y
    );
  }

  void main() {
    vec2 centred = abs(vUv - 0.5) * 2.0;
    float rectangularDistance =
      max(centred.x, centred.y) - uInnerRatio;
    float boundaryMist = smoothstep(
      -uTransition,
      uTransition,
      rectangularDistance
    );

    vec2 drift =
      vWorldPosition.xz * 0.34 +
      vec2(uTime * uSpeed, -uTime * uSpeed * 0.42);
    float broad = noise21(drift);
    float detail = noise21(drift * 2.17 + 9.3);
    float shape = mix(0.62, 1.0, broad * 0.72 + detail * 0.28);

    float outerSeal = smoothstep(
      uInnerRatio + uTransition,
      0.94,
      max(centred.x, centred.y)
    );
    float alpha = boundaryMist * shape * uDensity;
    alpha = max(alpha, outerSeal * uDensity * 0.72);
    float seamBand = 1.0 - smoothstep(
      0.0,
      uTransition * 1.85,
      abs(rectangularDistance)
    );
    alpha = max(
      alpha,
      seamBand * mix(0.78, 0.92, shape)
    );

    if (alpha <= 0.003) discard;
    float paleMist = smoothstep(
      uTransition * 0.65,
      uTransition * 4.2,
      max(rectangularDistance, 0.0)
    );
    vec3 mistColor = mix(
      uSeamColor,
      uMistColor,
      paleMist * (0.42 + broad * 0.34)
    );
    gl_FragColor = vec4(mistColor, clamp(alpha, 0.0, 0.94));
  }
`;

export function MapOceanHorizon({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const oceanMeshRef = useRef<Mesh>(null);
  const mistMeshRef = useRef<Mesh>(null);
  const horizon = config.oceanHorizon;
  const enabled = horizon?.enabled ?? true;
  const extensionScale = Math.max(
    2,
    horizon?.extensionScale ?? DEFAULT_EXTENSION_SCALE,
  );
  const transitionWidth = Math.max(
    0.02,
    horizon?.transitionWidth ?? DEFAULT_TRANSITION_WIDTH,
  );
  const seabedDrop = Math.max(
    0.4,
    horizon?.seabedDrop ?? DEFAULT_SEABED_DROP,
  );
  const mistMode = horizon?.mist?.mode ?? "horizon";
  const mistEnabled =
    (horizon?.mist?.enabled ?? true) && mistMode === "horizon";

  const width = geometry.planeWidth * extensionScale;
  const depth = geometry.planeHeight * extensionScale;

  const oceanGeometry = useMemo(
    () => new PlaneGeometry(width, depth, 1, 1),
    [depth, width],
  );
  const seabedGeometry = useMemo(
    () => new PlaneGeometry(width, depth, 1, 1),
    [depth, width],
  );

  const deepColor = useMemo(
    () =>
      new Color(
        horizon?.deepWaterColor ??
          config.seaRendering?.deepColor ??
          config.palette.seaDeep,
      ),
    [
      config.palette.seaDeep,
      config.seaRendering?.deepColor,
      horizon?.deepWaterColor,
    ],
  );
  const horizonColor = useMemo(
    () =>
      new Color(
        horizon?.horizonColor ??
          config.palette.background ??
          config.palette.seaDeep,
      ).lerp(deepColor, 0.46),
    [
      config.palette.background,
      config.palette.seaDeep,
      deepColor,
      horizon?.horizonColor,
    ],
  );

  const oceanMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: horizonVertexShader,
        fragmentShader: oceanFragmentShader,
        depthWrite: true,
        depthTest: true,
        toneMapped: false,
        uniforms: {
          uDeepColor: { value: deepColor },
          uHorizonColor: { value: horizonColor },
          uTime: { value: 0 },
          uExtensionScale: { value: extensionScale },
        },
      }),
    [deepColor, extensionScale, horizonColor],
  );

  const mistMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: horizonVertexShader,
        fragmentShader: mistFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        toneMapped: false,
        uniforms: {
          uMistColor: {
            value: horizonColor.clone().lerp(new Color("#d7e3df"), 0.34),
          },
          uSeamColor: {
            value: deepColor.clone().lerp(horizonColor, 0.18),
          },
          uTime: { value: 0 },
          uInnerRatio: { value: 1 / extensionScale },
          uTransition: {
            value:
              (transitionWidth * 2) /
              extensionScale,
          },
          uDensity: { value: horizon?.mist?.density ?? 0.46 },
          uSpeed: { value: horizon?.mist?.speed ?? 0.022 },
        },
      }),
    [
      extensionScale,
      deepColor,
      horizon?.mist?.density,
      horizon?.mist?.speed,
      horizonColor,
      transitionWidth,
    ],
  );

  const seabedMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: horizonColor.clone().multiplyScalar(0.42),
        roughness: 1,
        metalness: 0,
      }),
    [horizonColor],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const activeOceanMaterial =
      oceanMeshRef.current?.material as ShaderMaterial | undefined;
    const activeMistMaterial =
      mistMeshRef.current?.material as ShaderMaterial | undefined;
    if (activeOceanMaterial) {
      activeOceanMaterial.uniforms.uTime.value = time;
    }
    if (activeMistMaterial) {
      activeMistMaterial.uniforms.uTime.value = time;
    }
  }, -21);

  useEffect(
    () => () => {
      oceanGeometry.dispose();
      seabedGeometry.dispose();
      oceanMaterial.dispose();
      mistMaterial.dispose();
      seabedMaterial.dispose();
    },
    [
      mistMaterial,
      oceanGeometry,
      oceanMaterial,
      seabedGeometry,
      seabedMaterial,
    ],
  );

  if (!enabled || parchment) return null;

  return (
    <>
      <mesh
        geometry={seabedGeometry}
        material={seabedMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -seabedDrop, 0]}
        renderOrder={-42}
      />
      <mesh
        ref={oceanMeshRef}
        geometry={oceanGeometry}
        material={oceanMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.012, 0]}
        renderOrder={-40}
      />
      {mistEnabled ? (
        <mesh
          ref={mistMeshRef}
          geometry={oceanGeometry}
          material={mistMaterial}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.018, 0]}
          renderOrder={850}
        />
      ) : null}
    </>
  );
}
