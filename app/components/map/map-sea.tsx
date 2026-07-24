"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, DoubleSide, ShaderMaterial } from "three";
import type { DerivedMapGeometry, NationMapConfig } from "../../data/maps/types";

const vertexShader = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 transformed = position;
    float wave = sin(position.x * 1.25 + uTime * .55) * .035;
    wave += cos(position.y * 1.7 - uTime * .38) * .025;
    wave += sin((position.x + position.y) * 2.4 + uTime * .24) * .012;
    transformed.z += wave;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    float band = smoothstep(-.06, .07, vWave);
    float shimmer = sin((vUv.x + vUv.y) * 90.0 + uTime * .7) * .018;
    vec3 color = mix(uDeep, uShallow, band + shimmer + .22);
    gl_FragColor = vec4(color, .96);
  }
`;

export function MapSea({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new Color(config.palette.seaDeep) },
      uShallow: { value: new Color(config.palette.seaShallow) },
    }),
    [config.palette.seaDeep, config.palette.seaShallow],
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uDeep.value.set(
      parchment ? "#756b5a" : config.palette.seaDeep,
    );
    material.current.uniforms.uShallow.value.set(
      parchment ? "#a99b80" : config.palette.seaShallow,
    );
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
      <planeGeometry
        args={[geometry.planeWidth + 18, geometry.planeHeight + 14, 160, 96]}
      />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={DoubleSide}
      />
    </mesh>
  );
}