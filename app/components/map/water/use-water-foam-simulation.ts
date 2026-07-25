"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
} from "three";

const foamUpdateVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const foamUpdateFragmentShader = `
  precision highp float;

  uniform sampler2D uPreviousFoam;
  uniform sampler2D uCurrentMap;
  uniform sampler2D uLandMask;
  uniform sampler2D uCoastDistance;

  uniform vec2 uTexelSize;
  uniform float uDelta;
  uniform float uTime;
  uniform float uAdvection;
  uniform float uDecay;
  uniform float uDiffusion;
  uniform float uCoastInjection;
  uniform float uImpactInjection;
  uniform float uAlongshoreDrift;
  uniform float uTurbulence;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  vec2 decodeCurrent(vec4 encoded) {
    vec2 direction = encoded.rg * 2.0 - 1.0;
    float directionLength = length(direction);

    if (directionLength < 0.001) {
      return vec2(0.0);
    }

    return direction / directionLength * encoded.b;
  }

  float sampleLand(vec2 uv) {
    return texture2D(uLandMask, clamp(uv, vec2(0.0), vec2(1.0))).r;
  }

  float sampleDistance(vec2 uv) {
    return texture2D(uCoastDistance, clamp(uv, vec2(0.0), vec2(1.0))).r;
  }

  void main() {
    vec4 encodedCurrent = texture2D(uCurrentMap, vUv);
    vec2 current = decodeCurrent(encodedCurrent);

    /*
     * Ricaviamo subito la normale costiera per aggiungere
     * una lieve deriva tangenziale. In questo modo la foam
     * non si limita a pulsare: scorre lungo il litorale e
     * segue le correnti senza allontanarsi troppo dalla riva.
     */
    float distanceToCoast = sampleDistance(vUv);
    float distanceLeft = sampleDistance(vUv - vec2(uTexelSize.x, 0.0));
    float distanceRight = sampleDistance(vUv + vec2(uTexelSize.x, 0.0));
    float distanceDown = sampleDistance(vUv - vec2(0.0, uTexelSize.y));
    float distanceUp = sampleDistance(vUv + vec2(0.0, uTexelSize.y));

    vec2 coastGradient = vec2(
      distanceRight - distanceLeft,
      distanceUp - distanceDown
    );

    vec2 coastNormal = length(coastGradient) > 0.00001
      ? normalize(coastGradient)
      : vec2(0.0);

    vec2 coastTangent = vec2(-coastNormal.y, coastNormal.x);
    float coastBandForMotion = 1.0 - smoothstep(0.015, 0.13, distanceToCoast);

    float turbulenceNoise = noise(
      vUv * vec2(34.0, 21.0) +
      vec2(uTime * 0.055, -uTime * 0.037)
    ) * 2.0 - 1.0;

    float currentMagnitudeForMotion = clamp(encodedCurrent.b, 0.0, 1.0);
    float tangentSign = dot(current, coastTangent) >= 0.0 ? 1.0 : -1.0;

    vec2 alongshoreVelocity =
      coastTangent *
      tangentSign *
      coastBandForMotion *
      currentMagnitudeForMotion *
      uAlongshoreDrift;

    vec2 turbulentVelocity =
      coastTangent *
      turbulenceNoise *
      coastBandForMotion *
      uTurbulence;

    vec2 transportVelocity =
      current +
      alongshoreVelocity +
      turbulentVelocity;

    vec2 backtracedUv = clamp(
      vUv - transportVelocity * uDelta * uAdvection,
      vec2(0.0),
      vec2(1.0)
    );

    float center = texture2D(uPreviousFoam, backtracedUv).r;
    float left = texture2D(uPreviousFoam, backtracedUv - vec2(uTexelSize.x, 0.0)).r;
    float right = texture2D(uPreviousFoam, backtracedUv + vec2(uTexelSize.x, 0.0)).r;
    float down = texture2D(uPreviousFoam, backtracedUv - vec2(0.0, uTexelSize.y)).r;
    float up = texture2D(uPreviousFoam, backtracedUv + vec2(0.0, uTexelSize.y)).r;

    float blurred = (center * 4.0 + left + right + down + up) / 8.0;
    float foam = mix(center, blurred, clamp(uDiffusion * uDelta * 60.0, 0.0, 0.45));
    foam *= exp(-uDecay * uDelta);

    float land = sampleLand(vUv);
    float water = 1.0 - smoothstep(0.25, 0.75, land);

    float currentMagnitude = clamp(encodedCurrent.b, 0.0, 1.0);
    vec2 currentDirection = length(current) > 0.0001
      ? normalize(current)
      : vec2(0.0);

    float coastBand = 1.0 - smoothstep(0.0, 0.085, distanceToCoast);
    float directContact = 1.0 - smoothstep(0.0, 0.016, distanceToCoast);
    float impact = max(dot(currentDirection, -coastNormal), 0.0);

    float breakup = mix(
      0.28,
      1.0,
      noise(vUv * vec2(180.0, 105.0) + current * uTime * 0.45)
    );

    float pulse = 0.58 + 0.42 * sin(
      uTime * 1.35 +
      noise(vUv * vec2(52.0, 31.0)) * 6.2831853
    );

    float injection =
      directContact * uCoastInjection * (0.16 + 0.32 * pulse) +
      coastBand * impact * currentMagnitude * uImpactInjection;

    foam += injection * breakup * uDelta;
    foam *= water;

    gl_FragColor = vec4(vec3(clamp(foam, 0.0, 1.0)), 1.0);
  }
`;

type WaterFoamSimulationOptions = {
  currentMap: Texture;
  landMask: Texture;
  coastDistance: Texture;
  width?: number;
  height?: number;
};

function createTarget(width: number, height: number) {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
  });

  target.texture.generateMipmaps = false;
  return target;
}

export function useWaterFoamSimulation({
  currentMap,
  landMask,
  coastDistance,
  width = 1024,
  height = 576,
}: WaterFoamSimulationOptions) {
  const { gl } = useThree();
  const textureRef = useRef<Texture | null>(null);
  const readIndexRef = useRef(0);

  const resources = useMemo(() => {
    const targets = [
      createTarget(width, height),
      createTarget(width, height),
    ] as const;

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);
    const material = new ShaderMaterial({
      vertexShader: foamUpdateVertexShader,
      fragmentShader: foamUpdateFragmentShader,
      depthWrite: false,
      depthTest: false,
      blending: NoBlending,
      uniforms: {
        uPreviousFoam: { value: targets[0].texture },
        uCurrentMap: { value: currentMap },
        uLandMask: { value: landMask },
        uCoastDistance: { value: coastDistance },
        uTexelSize: { value: new Vector2(1 / width, 1 / height) },
        uDelta: { value: 0 },
        uTime: { value: 0 },
        uAdvection: { value: 0.078 },
        uDecay: { value: 0.20 },
        uDiffusion: { value: 0.042 },
        uCoastInjection: { value: 1.65 },
        uImpactInjection: { value: 6.0 },
        uAlongshoreDrift: { value: 0.24 },
        uTurbulence: { value: 0.075 },
      },
    });

    scene.add(new Mesh(geometry, material));

    return { targets, scene, camera, geometry, material };
  }, [coastDistance, currentMap, height, landMask, width]);

  useEffect(() => {
    textureRef.current = resources.targets[0].texture;

    const previousTarget = gl.getRenderTarget();
    const previousClearColor = gl.getClearColor(new Color()).clone();
    const previousClearAlpha = gl.getClearAlpha();

    /*
     * I render target della foam devono partire da nero puro.
     * gl.clear() usa il clear color globale del renderer: se la scena
     * ha uno sfondo grigio/azzurro, quel valore diventa foam diffusa
     * su tutto il mare e lo screen blend produce l'effetto slavato.
     */
    gl.setClearColor(0x000000, 1);

    gl.setRenderTarget(resources.targets[0]);
    gl.clear(true, true, true);

    gl.setRenderTarget(resources.targets[1]);
    gl.clear(true, true, true);

    gl.setRenderTarget(previousTarget);
    gl.setClearColor(previousClearColor, previousClearAlpha);

    return () => {
      textureRef.current = null;
      resources.geometry.dispose();
      resources.material.dispose();
      resources.targets[0].dispose();
      resources.targets[1].dispose();
    };
  }, [gl, resources]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const readIndex = readIndexRef.current;
    const writeIndex = 1 - readIndex;
    const readTarget = resources.targets[readIndex];
    const writeTarget = resources.targets[writeIndex];

    resources.material.uniforms.uPreviousFoam.value = readTarget.texture;
    resources.material.uniforms.uDelta.value = delta;
    resources.material.uniforms.uTime.value = state.clock.elapsedTime;

    const previousTarget = gl.getRenderTarget();
    gl.setRenderTarget(writeTarget);
    gl.render(resources.scene, resources.camera);
    gl.setRenderTarget(previousTarget);

    readIndexRef.current = writeIndex;
    textureRef.current = writeTarget.texture;
  }, -20);

  return textureRef;
}
