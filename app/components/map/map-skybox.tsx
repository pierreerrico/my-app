"use client";

import { useEffect, useMemo } from "react";
import {
  BackSide,
  Color,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import { getMapAtmosphereColors } from "./map-atmosphere";

const vertexShader = /* glsl */ `
  varying vec3 vWorldDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uLowerColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uSunStrength;

  varying vec3 vWorldDirection;

  void main() {
    vec3 direction = normalize(vWorldDirection);

    float height = direction.y * 0.5 + 0.5;
    float upperBlend = smoothstep(0.40, 0.96, height);
    float lowerBlend = smoothstep(0.00, 0.46, height);

    vec3 sky = mix(uLowerColor, uHorizonColor, lowerBlend);
    sky = mix(sky, uZenithColor, upperBlend);

    float horizonGlow = pow(1.0 - abs(direction.y), 5.0);
    sky += uHorizonColor * horizonGlow * 0.16;

    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
    float sunDisc = pow(sunDot, 900.0);
    float sunHalo = pow(sunDot, 18.0);

    sky += uSunColor * (
      sunDisc * uSunStrength +
      sunHalo * uSunStrength * 0.12
    );

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function MapSkybox({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const radius = Math.max(
    geometry.planeWidth,
    geometry.planeHeight,
    20,
  ) * 12;

  const sphereGeometry = useMemo(
    () => new SphereGeometry(radius, 48, 24),
    [radius],
  );

  const material = useMemo(() => {
    const {
      horizon,
      zenith,
      lower,
    } = getMapAtmosphereColors(
      config,
    );

    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
      uniforms: {
        uZenithColor: { value: zenith },
        uHorizonColor: { value: horizon },
        uLowerColor: { value: lower },
        uSunColor: { value: new Color("#fff0c7") },
        uSunDirection: {
          value: new Vector3(-0.48, 0.72, 0.50),
        },
        uSunStrength: { value: 1.15 },
      },
    });
  }, [config]);

  useEffect(
    () => () => {
      sphereGeometry.dispose();
      material.dispose();
    },
    [material, sphereGeometry],
  );

  return (
    <mesh
      geometry={sphereGeometry}
      material={material}
      visible={!parchment}
      frustumCulled={false}
      renderOrder={-1000}
    />
  );
}
