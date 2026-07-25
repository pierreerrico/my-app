"use client";

import {
  useFrame,
  useLoader,
} from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  FrontSide,
  LinearFilter,
  Mesh,
  NoColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";

/*
 * EDGE FOG
 *
 * A shallow marine volume centred on sea level. Its density is authored by
 * textures.fogMap itself: the image is not merely an allow/deny mask, but the
 * actual large-scale fog field. Procedural 3D noise only animates and billows
 * that authored density without replacing its placement.
 */
const EDGE_FOG_SCALE = 2.45;
const FOG_INWARD_OVERLAP_RATIO = 0.095;
const FOG_BOTTOM_Y = -0.070;
const FOG_TOP_Y = 0.32;

/*
 * MOVING CLOUDS
 *
 * A second sparse volumetric slab crosses the entire atlas above sea level.
 * Its density fades before reaching the box boundary, so the cloud container
 * itself remains invisible.
 */
const CLOUD_VOLUME_SCALE = 1.85;
const CLOUD_BOTTOM_Y = 0.42;
const CLOUD_TOP_Y = 1.18;

function cloneScalarMap(
  source: Texture,
): Texture {
  const texture = source.clone();

  texture.colorSpace = NoColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = source.flipY;
  texture.needsUpdate = true;

  return texture;
}

const volumeVertexShader = /* glsl */ `
  varying vec3 vLocalPosition;

  void main() {
    vLocalPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const commonVolumeNoise = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z);
  }

  float fbm3(vec3 p) {
    float result = 0.0;
    float amplitude = 0.5;

    for (int octave = 0; octave < 4; octave++) {
      result += valueNoise3(p) * amplitude;
      p = p * 2.03 + vec3(17.1, 9.2, 13.7);
      amplitude *= 0.5;
    }

    return result;
  }

  vec2 intersectBox(vec3 ro, vec3 rd, vec3 halfSize) {
    vec3 safeDirection = vec3(
      rd.x >= 0.0 ? max(rd.x, 0.00001) : min(rd.x, -0.00001),
      rd.y >= 0.0 ? max(rd.y, 0.00001) : min(rd.y, -0.00001),
      rd.z >= 0.0 ? max(rd.z, 0.00001) : min(rd.z, -0.00001)
    );

    vec3 invDirection = 1.0 / safeDirection;
    vec3 t0 = (-halfSize - ro) * invDirection;
    vec3 t1 = ( halfSize - ro) * invDirection;
    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    float tEnter = max(max(tMin.x, tMin.y), tMin.z);
    float tExit = min(min(tMax.x, tMax.y), tMax.z);

    return vec2(tEnter, tExit);
  }

  float outsideRectangleDistance(vec2 p, vec2 halfSize) {
    vec2 q = abs(p) - halfSize;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  }
`;

const edgeFogFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uLandMask;
  uniform sampler2D uFogMap;

  uniform vec3 uFogBaseColor;
  uniform vec3 uFogLightColor;
  uniform vec3 uFogGlowColor;

  uniform vec3 uHalfExtents;
  uniform vec2 uMapHalfExtents;
  uniform float uInwardOverlap;
  uniform float uShellThickness;
  uniform float uSeaLevel;
  uniform float uTime;
  uniform vec3 uCameraLocal;

  varying vec3 vLocalPosition;

  #define STEPS 38

  ${commonVolumeNoise}

  vec2 worldToMapUv(vec2 worldXZ) {
    return vec2(
      worldXZ.x / max(uMapHalfExtents.x * 2.0, 0.0001) + 0.5,
      -worldXZ.y / max(uMapHalfExtents.y * 2.0, 0.0001) + 0.5
    );
  }

  float insideMapAt(vec2 worldXZ) {
    return
      step(abs(worldXZ.x), uMapHalfExtents.x) *
      step(abs(worldXZ.y), uMapHalfExtents.y);
  }

  float waterAvailability(vec2 worldXZ) {
    vec2 uv = worldToMapUv(worldXZ);
    float insideMap = insideMapAt(worldXZ);

    float land = texture2D(
      uLandMask,
      clamp(uv, vec2(0.0), vec2(1.0))
    ).r;

    float water = 1.0 - smoothstep(0.24, 0.72, land);

    return mix(1.0, water, insideMap);
  }

  float authoredFogDensity(
    vec2 worldXZ,
    float animatedWarp
  ) {
    vec2 uv = worldToMapUv(worldXZ);
    float insideMap = insideMapAt(worldXZ);

    /*
     * The authored map is the fog itself. We only breathe its contours by a
     * few thousandths of UV space, so its painted placement remains intact.
     */
    vec2 warpDirection = vec2(
      sin(uTime * 0.075 + animatedWarp * 5.2),
      cos(uTime * 0.061 - animatedWarp * 4.6)
    );

    vec2 warpedUv = clamp(
      uv + warpDirection * 0.0065,
      vec2(0.0),
      vec2(1.0)
    );

    float authored = texture2D(
      uFogMap,
      warpedUv
    ).r;

    /* Preserve soft grayscale values instead of converting the map to binary. */
    authored = pow(clamp(authored, 0.0, 1.0), 1.12);

    /* Outside the map, keep a guaranteed fog mass to hide the finite plane. */
    return mix(1.0, authored, insideMap);
  }

  vec3 fogField(vec3 p) {
    float signedMapDistance = outsideRectangleDistance(
      p.xz,
      uMapHalfExtents
    );

    float shellProgress = clamp(
      (signedMapDistance + uInwardOverlap) /
      max(uShellThickness + uInwardOverlap, 0.0001),
      0.0,
      1.0
    );

    float relativeHeight = p.y - uSeaLevel;

    float lowerFade = smoothstep(
      -0.066,
      0.014,
      relativeHeight
    );

    float upperFade = 1.0 - smoothstep(
      0.190,
      0.315,
      relativeHeight
    );

    float seaCore = exp(
      -pow((relativeHeight - 0.060) / 0.105, 2.0)
    );

    float verticalProfile =
      lowerFade *
      upperFade *
      mix(0.68, 1.0, seaCore);

    vec3 broadPosition = p * vec3(0.60, 3.45, 0.56);
    broadPosition += vec3(
      uTime * 0.038,
      uTime * 0.011,
      -uTime * 0.030
    );

    float domainWarp = fbm3(
      broadPosition * 0.52 +
      vec3(3.7, 8.1, -5.4)
    );

    vec3 warpedPosition = broadPosition + vec3(
      domainWarp * 1.42,
      domainWarp * 0.48,
      -domainWarp * 1.16
    );

    float broadBillows = fbm3(warpedPosition);

    float mediumBillows = fbm3(
      p * vec3(1.34, 5.4, 1.18) +
      vec3(
        -uTime * 0.062,
        uTime * 0.018,
        uTime * 0.050
      ) +
      vec3(-4.8, 11.3, 6.1)
    );

    float fineErosion = fbm3(
      p * vec3(2.68, 8.7, 2.34) +
      vec3(
        uTime * 0.082,
        -uTime * 0.022,
        -uTime * 0.068
      )
    );

    float billowField =
      broadBillows * 0.58 +
      mediumBillows * 0.30 +
      fineErosion * 0.12;

    float cloudBody = smoothstep(
      0.445,
      0.665,
      billowField
    );

    float cloudErosion = smoothstep(
      0.28,
      0.78,
      fineErosion
    );

    float puffyCloud = cloudBody * mix(
      0.56,
      1.0,
      cloudErosion
    );

    /*
     * Guaranteed opaque seal: noise shapes the foam-like surface but can no
     * longer punch a hole through the real geometric border.
     */
    float hardBoundarySeal = smoothstep(
      -uInwardOverlap * 0.82,
      uInwardOverlap * 0.16,
      signedMapDistance
    );

    float outerMass = smoothstep(
      0.0,
      0.64,
      shellProgress
    );

    float authoredDensity = authoredFogDensity(
      p.xz,
      domainWarp
    );

    /*
     * The grayscale fog map is the primary density source. The procedural
     * fields only give it volume, internal cavities and animated billows.
     */
    float animatedVolume = mix(
      0.54,
      1.46,
      puffyCloud
    );

    animatedVolume *= mix(
      0.82,
      1.16,
      broadBillows
    );

    float mapFog =
      authoredDensity *
      animatedVolume *
      1.58;

    float borderSeal =
      hardBoundarySeal *
      (
        1.72 +
        broadBillows * 0.44 +
        outerMass * (0.34 + mediumBillows * 0.28)
      );

    float density =
      verticalProfile *
      max(mapFog, borderSeal);

    density *= waterAvailability(p.xz);

    float luminousEdge =
      smoothstep(0.07, 0.42, density) *
      (1.0 - smoothstep(0.72, 1.70, density));

    float mysticPulse =
      0.74 +
      0.26 * sin(
        uTime * 0.40 +
        p.x * 0.70 -
        p.z * 0.54 +
        domainWarp * 4.0
      );

    float lightFactor = clamp(
      0.24 +
      luminousEdge * 0.66 +
      seaCore * 0.10,
      0.0,
      1.0
    );

    float glowFactor =
      luminousEdge *
      mysticPulse *
      0.32;

    return vec3(
      clamp(density, 0.0, 2.5),
      lightFactor,
      glowFactor
    );
  }

  void main() {
    vec3 ro = uCameraLocal;
    vec3 rd = normalize(vLocalPosition - ro);

    vec2 hit = intersectBox(ro, rd, uHalfExtents);
    float tEnter = max(hit.x, 0.0);
    float tExit = hit.y;

    if (tExit <= tEnter) {
      discard;
    }

    float segmentLength = tExit - tEnter;
    float stepSize = segmentLength / float(STEPS);

    float jitter = hash12(
      gl_FragCoord.xy +
      vec2(fract(uTime * 0.07) * 37.0)
    );

    float t = tEnter + stepSize * jitter * 0.72;
    float accumulatedAlpha = 0.0;
    vec3 accumulatedColor = vec3(0.0);

    for (int i = 0; i < STEPS; i++) {
      if (t >= tExit || accumulatedAlpha >= 0.992) {
        break;
      }

      vec3 p = ro + rd * (t + stepSize * 0.5);
      vec3 fogSample = fogField(p);

      float density = fogSample.x;
      float sampleAlpha = 1.0 - exp(
        -density * stepSize * 7.25
      );

      vec3 sampleColor = mix(
        uFogBaseColor,
        uFogLightColor,
        fogSample.y
      );

      sampleColor = mix(
        sampleColor,
        uFogGlowColor,
        fogSample.z
      );

      accumulatedColor +=
        (1.0 - accumulatedAlpha) *
        sampleColor *
        sampleAlpha;

      accumulatedAlpha +=
        (1.0 - accumulatedAlpha) *
        sampleAlpha;

      t += stepSize;
    }

    if (accumulatedAlpha <= 0.003) {
      discard;
    }

    gl_FragColor = vec4(
      accumulatedColor / max(accumulatedAlpha, 0.0001),
      clamp(accumulatedAlpha, 0.0, 1.0)
    );
  }
`;

const movingCloudFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uCloudBaseColor;
  uniform vec3 uCloudLightColor;
  uniform vec3 uCloudGlowColor;
  uniform vec3 uHalfExtents;
  uniform vec2 uWindDirection;
  uniform float uTime;
  uniform vec3 uCameraLocal;

  varying vec3 vLocalPosition;

  #define STEPS 24

  ${commonVolumeNoise}

  vec3 cloudField(vec3 p) {
    float vertical01 = clamp(
      (p.y + uHalfExtents.y) /
      max(uHalfExtents.y * 2.0, 0.0001),
      0.0,
      1.0
    );

    float verticalShape =
      smoothstep(0.02, 0.22, vertical01) *
      (1.0 - smoothstep(0.72, 0.98, vertical01));

    vec2 horizontalNormal = vec2(
      abs(p.x) / max(uHalfExtents.x, 0.0001),
      abs(p.z) / max(uHalfExtents.z, 0.0001)
    );

    float containerFade = 1.0 - smoothstep(
      0.70,
      0.98,
      max(horizontalNormal.x, horizontalNormal.y)
    );

    vec2 wind = normalize(uWindDirection);
    vec2 tangent = vec2(-wind.y, wind.x);

    vec2 windSpace = vec2(
      dot(p.xz, wind),
      dot(p.xz, tangent)
    );

    vec2 drift = vec2(
      uTime * 0.052,
      -uTime * 0.010
    );

    vec3 broadPosition = vec3(
      windSpace.x * 0.38 + drift.x,
      p.y * 2.15 + uTime * 0.006,
      windSpace.y * 0.62 + drift.y
    );

    float domainWarp = fbm3(
      broadPosition * 0.64 +
      vec3(7.3, -2.8, 11.4)
    );

    vec3 warped = broadPosition + vec3(
      domainWarp * 1.45,
      domainWarp * 0.44,
      -domainWarp * 1.10
    );

    float broadBanks = fbm3(warped);

    float mediumPuffs = fbm3(
      vec3(
        windSpace.x * 0.82 + uTime * 0.076,
        p.y * 3.65 - uTime * 0.010,
        windSpace.y * 1.08 - uTime * 0.018
      ) +
      vec3(-4.2, 9.6, 5.7)
    );

    float fineErosion = fbm3(
      vec3(
        windSpace.x * 1.62 + uTime * 0.098,
        p.y * 6.2 + uTime * 0.015,
        windSpace.y * 1.78 - uTime * 0.031
      )
    );

    float cloudNoise =
      broadBanks * 0.62 +
      mediumPuffs * 0.28 +
      fineErosion * 0.10;

    /* Sparse banks with distinct rounded lobes rather than full-screen haze. */
    float cloudBody = smoothstep(
      0.525,
      0.690,
      cloudNoise
    );

    float erodedBody = cloudBody * mix(
      0.54,
      1.0,
      smoothstep(0.24, 0.80, fineErosion)
    );

    float density =
      erodedBody *
      verticalShape *
      containerFade *
      1.18;

    float luminousEdge =
      smoothstep(0.04, 0.28, density) *
      (1.0 - smoothstep(0.42, 1.05, density));

    float topLight = smoothstep(
      0.30,
      0.88,
      vertical01
    );

    float lightFactor = clamp(
      0.36 +
      topLight * 0.30 +
      luminousEdge * 0.34,
      0.0,
      1.0
    );

    float mysticGlow =
      luminousEdge *
      (0.72 + 0.28 * sin(
        uTime * 0.28 +
        windSpace.x * 0.38 +
        domainWarp * 3.6
      )) *
      0.24;

    return vec3(
      clamp(density, 0.0, 1.4),
      lightFactor,
      mysticGlow
    );
  }

  void main() {
    vec3 ro = uCameraLocal;
    vec3 rd = normalize(vLocalPosition - ro);

    vec2 hit = intersectBox(ro, rd, uHalfExtents);
    float tEnter = max(hit.x, 0.0);
    float tExit = hit.y;

    if (tExit <= tEnter) {
      discard;
    }

    float segmentLength = tExit - tEnter;
    float stepSize = segmentLength / float(STEPS);

    float jitter = hash12(
      gl_FragCoord.xy * 0.73 +
      vec2(fract(uTime * 0.05) * 23.0)
    );

    float t = tEnter + stepSize * jitter * 0.80;
    float accumulatedAlpha = 0.0;
    vec3 accumulatedColor = vec3(0.0);

    for (int i = 0; i < STEPS; i++) {
      if (t >= tExit || accumulatedAlpha >= 0.92) {
        break;
      }

      vec3 p = ro + rd * (t + stepSize * 0.5);
      vec3 cloudSample = cloudField(p);

      float density = cloudSample.x;
      float sampleAlpha = 1.0 - exp(
        -density * stepSize * 3.10
      );

      vec3 sampleColor = mix(
        uCloudBaseColor,
        uCloudLightColor,
        cloudSample.y
      );

      sampleColor = mix(
        sampleColor,
        uCloudGlowColor,
        cloudSample.z
      );

      accumulatedColor +=
        (1.0 - accumulatedAlpha) *
        sampleColor *
        sampleAlpha;

      accumulatedAlpha +=
        (1.0 - accumulatedAlpha) *
        sampleAlpha;

      t += stepSize;
    }

    if (accumulatedAlpha <= 0.006) {
      discard;
    }

    gl_FragColor = vec4(
      accumulatedColor / max(accumulatedAlpha, 0.0001),
      clamp(accumulatedAlpha * 0.72, 0.0, 0.78)
    );
  }
`;

export function MapEdgeFog({
  config,
  geometry,
  parchment,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
}) {
  const fogMeshRef = useRef<Mesh>(null);
  const cloudMeshRef = useRef<Mesh>(null);

  const landMaskPath =
    config.textures.landMask;

  const fogMapPath =
    config.textures.fogMap;

  if (!landMaskPath || !fogMapPath) {
    throw new Error(
      `La mappa "${config.id}" deve definire textures.landMask e textures.fogMap per la nebbia volumetrica marina.`,
    );
  }

  const [
    landMaskSource,
    fogMapSource,
  ] = useLoader(
    TextureLoader,
    [
      landMaskPath,
      fogMapPath,
    ],
  );

  const landMask = useMemo(
    () => cloneScalarMap(landMaskSource),
    [landMaskSource],
  );

  const fogMap = useMemo(
    () => cloneScalarMap(fogMapSource),
    [fogMapSource],
  );

  const fogVolumeWidth =
    geometry.planeWidth * EDGE_FOG_SCALE;

  const fogVolumeDepth =
    geometry.planeHeight * EDGE_FOG_SCALE;

  const fogVolumeHeight =
    FOG_TOP_Y - FOG_BOTTOM_Y;

  const fogVolumeCenterY =
    (FOG_TOP_Y + FOG_BOTTOM_Y) * 0.5;

  const inwardOverlap =
    Math.min(
      geometry.planeWidth,
      geometry.planeHeight,
    ) * FOG_INWARD_OVERLAP_RATIO;

  const cloudVolumeWidth =
    geometry.planeWidth * CLOUD_VOLUME_SCALE;

  const cloudVolumeDepth =
    geometry.planeHeight * CLOUD_VOLUME_SCALE;

  const cloudVolumeHeight =
    CLOUD_TOP_Y - CLOUD_BOTTOM_Y;

  const cloudVolumeCenterY =
    (CLOUD_TOP_Y + CLOUD_BOTTOM_Y) * 0.5;

  const fogGeometry = useMemo(
    () =>
      new BoxGeometry(
        fogVolumeWidth,
        fogVolumeHeight,
        fogVolumeDepth,
        1,
        1,
        1,
      ),
    [
      fogVolumeDepth,
      fogVolumeHeight,
      fogVolumeWidth,
    ],
  );

  const cloudGeometry = useMemo(
    () =>
      new BoxGeometry(
        cloudVolumeWidth,
        cloudVolumeHeight,
        cloudVolumeDepth,
        1,
        1,
        1,
      ),
    [
      cloudVolumeDepth,
      cloudVolumeHeight,
      cloudVolumeWidth,
    ],
  );

  const fogMaterial = useMemo(() => {
    const background = new Color(
      config.palette.background ??
        config.palette.seaDeep,
    );

    const baseColor = background
      .clone()
      .lerp(
        new Color("#b9ced1"),
        0.72,
      );

    const lightColor = new Color(
      "#edf7f2",
    );

    const glowColor = new Color(
      "#c9fff1",
    );

    const shellThickness = Math.min(
      (fogVolumeWidth - geometry.planeWidth) * 0.5,
      (fogVolumeDepth - geometry.planeHeight) * 0.5,
    );

    return new ShaderMaterial({
      vertexShader: volumeVertexShader,
      fragmentShader: edgeFogFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: FrontSide,
      toneMapped: false,
      fog: false,
      uniforms: {
        uLandMask: {
          value: landMask,
        },
        uFogMap: {
          value: fogMap,
        },
        uFogBaseColor: {
          value: baseColor,
        },
        uFogLightColor: {
          value: lightColor,
        },
        uFogGlowColor: {
          value: glowColor,
        },
        uHalfExtents: {
          value: new Vector3(
            fogVolumeWidth * 0.5,
            fogVolumeHeight * 0.5,
            fogVolumeDepth * 0.5,
          ),
        },
        uMapHalfExtents: {
          value: new Vector2(
            geometry.planeWidth * 0.5,
            geometry.planeHeight * 0.5,
          ),
        },
        uInwardOverlap: {
          value: inwardOverlap,
        },
        uShellThickness: {
          value: shellThickness,
        },
        uSeaLevel: {
          value: -fogVolumeCenterY,
        },
        uTime: {
          value: 0,
        },
        uCameraLocal: {
          value: new Vector3(),
        },
      },
    });
  }, [
    config.palette.background,
    config.palette.seaDeep,
    fogVolumeCenterY,
    fogVolumeDepth,
    fogVolumeHeight,
    fogVolumeWidth,
    geometry.planeHeight,
    geometry.planeWidth,
    inwardOverlap,
    fogMap,
    landMask,
  ]);

  const cloudMaterial = useMemo(() => {
    const baseColor = new Color(
      "#cadbdc",
    );

    const lightColor = new Color(
      "#f4faf6",
    );

    const glowColor = new Color(
      "#d3fff4",
    );

    return new ShaderMaterial({
      vertexShader: volumeVertexShader,
      fragmentShader: movingCloudFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: FrontSide,
      toneMapped: false,
      fog: false,
      uniforms: {
        uCloudBaseColor: {
          value: baseColor,
        },
        uCloudLightColor: {
          value: lightColor,
        },
        uCloudGlowColor: {
          value: glowColor,
        },
        uHalfExtents: {
          value: new Vector3(
            cloudVolumeWidth * 0.5,
            cloudVolumeHeight * 0.5,
            cloudVolumeDepth * 0.5,
          ),
        },
        uWindDirection: {
          value: new Vector2(0.92, -0.38),
        },
        uTime: {
          value: 0,
        },
        uCameraLocal: {
          value: new Vector3(),
        },
      },
    });
  }, [
    cloudVolumeDepth,
    cloudVolumeHeight,
    cloudVolumeWidth,
  ]);

  useFrame((state) => {
    const elapsedTime =
      state.clock.elapsedTime;

    fogMaterial.uniforms.uTime.value =
      elapsedTime;

    cloudMaterial.uniforms.uTime.value =
      elapsedTime;

    if (fogMeshRef.current) {
      const localFogCamera =
        fogMeshRef.current.worldToLocal(
          state.camera.position.clone(),
        );

      fogMaterial.uniforms.uCameraLocal.value.copy(
        localFogCamera,
      );
    }

    if (cloudMeshRef.current) {
      const localCloudCamera =
        cloudMeshRef.current.worldToLocal(
          state.camera.position.clone(),
        );

      cloudMaterial.uniforms.uCameraLocal.value.copy(
        localCloudCamera,
      );
    }
  });

  useEffect(
    () => () => {
      fogGeometry.dispose();
      cloudGeometry.dispose();
      fogMaterial.dispose();
      cloudMaterial.dispose();
      landMask.dispose();
      fogMap.dispose();
    },
    [
      cloudGeometry,
      cloudMaterial,
      fogGeometry,
      fogMaterial,
      fogMap,
      landMask,
    ],
  );

  return (
    <>
      <mesh
        ref={cloudMeshRef}
        geometry={cloudGeometry}
        material={cloudMaterial}
        position={[0, cloudVolumeCenterY, 0]}
        visible={!parchment}
        frustumCulled={false}
        renderOrder={900}
      />

      <mesh
        ref={fogMeshRef}
        geometry={fogGeometry}
        material={fogMaterial}
        position={[0, fogVolumeCenterY, 0]}
        visible={!parchment}
        frustumCulled={false}
        renderOrder={1500}
      />
    </>
  );
}
