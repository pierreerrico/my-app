"use client";

import {
  useLoader,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
} from "react";
import {
  Color,
  PlaneGeometry,
  ShaderMaterial,
  TextureLoader,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
  NationMapWorldExtension,
} from "../../data/maps/types";
import { MapOceanHorizon } from "./map-ocean-horizon";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const landFragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;
  uniform vec3 uSeaColor;
  uniform sampler2D uEdgeMask;
  uniform float uExtensionScale;
  uniform float uTransitionWidth;
  uniform float uUseCoastalMask;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  void main() {
    vec2 centred = abs(vUv - 0.5) * 2.0;
    float boundary = max(centred.x, centred.y) * uExtensionScale;
    if (boundary < 0.985) discard;

    float distanceFromMap = smoothstep(
      1.0 - uTransitionWidth,
      uExtensionScale,
      boundary
    );
    float textureNoise = hash21(
      floor(vWorldPosition.xz * 2.4)
    );
    vec3 outer = uOuterColor;
    if (uUseCoastalMask > 0.5) {
      vec2 mapUv = clamp(
        (vUv - 0.5) * uExtensionScale + 0.5,
        vec2(0.002),
        vec2(0.998)
      );
      float land = texture2D(
        uEdgeMask,
        mapUv
      ).r;
      outer = mix(
        uSeaColor,
        uOuterColor,
        smoothstep(0.42, 0.58, land)
      );
    }
    vec3 color = mix(
      uInnerColor,
      outer,
      distanceFromMap
    );
    color *= 0.97 + textureNoise * 0.045;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function MapLandExtension({
  config,
  geometry,
  extension,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  extension: NationMapWorldExtension;
  parchment: boolean;
}) {
  const scale = Math.max(
    2,
    extension.extensionScale ?? 5,
  );
  const width =
    geometry.planeWidth * scale;
  const depth =
    geometry.planeHeight * scale;
  const plane = useMemo(
    () =>
      new PlaneGeometry(
        width,
        depth,
        1,
        1,
      ),
    [depth, width],
  );
  const edgeMask = useLoader(
    TextureLoader,
    extension.edgeMask ??
      config.textures.landMask,
  );
  const innerColor = useMemo(
    () =>
      new Color(
        extension.landColor ??
          config.palette.parchment,
      ),
    [
      config.palette.parchment,
      extension.landColor,
    ],
  );
  const outerColor = useMemo(() => {
    const color = new Color(
      extension.contextColor ??
        config.palette.background ??
        config.palette.seaDeep,
    );
    const desaturation =
      extension.desaturation ??
      (extension.mode === "context"
        ? 0.68
        : 0.28);
    const average =
      (color.r + color.g + color.b) /
      3;
    return color.lerp(
      new Color(
        average,
        average,
        average,
      ),
      desaturation,
    );
  }, [
    config.palette.background,
    config.palette.seaDeep,
    extension.contextColor,
    extension.desaturation,
    extension.mode,
  ]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader:
          landFragmentShader,
        toneMapped: false,
        uniforms: {
          uInnerColor: {
            value: innerColor,
          },
          uOuterColor: {
            value: outerColor,
          },
          uSeaColor: {
            value: new Color(
              config.seaRendering
                ?.deepColor ??
                config.palette.seaDeep,
            ),
          },
          uEdgeMask: {
            value: edgeMask,
          },
          uExtensionScale: {
            value: scale,
          },
          uTransitionWidth: {
            value:
              extension.transitionWidth ??
              0.14,
          },
          uUseCoastalMask: {
            value:
              extension.mode ===
              "coastal"
                ? 1
                : 0,
          },
        },
      }),
    [
      extension.transitionWidth,
      extension.mode,
      edgeMask,
      config.palette.seaDeep,
      config.seaRendering?.deepColor,
      innerColor,
      outerColor,
      scale,
    ],
  );

  useEffect(
    () => () => {
      plane.dispose();
      material.dispose();
    },
    [material, plane],
  );

  if (
    parchment ||
    extension.enabled === false
  ) {
    return null;
  }

  return (
    <mesh
      geometry={plane}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[
        0,
        -(extension.seabedDrop ?? 0.18),
        0,
      ]}
      renderOrder={-45}
    />
  );
}

export function MapWorldExtension({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const extension =
    config.worldExtension ??
    (config.oceanHorizon
      ? {
          ...config.oceanHorizon,
          mode: "ocean" as const,
        }
      : undefined);

  if (
    !extension ||
    extension.enabled === false ||
    extension.mode === "frame"
  ) {
    return null;
  }

  if (extension.mode === "ocean") {
    return (
      <MapOceanHorizon
        config={config}
        geometry={geometry}
        parchment={parchment}
      />
    );
  }

  return (
    <MapLandExtension
      config={config}
      geometry={geometry}
      extension={extension}
      parchment={parchment}
    />
  );
}
