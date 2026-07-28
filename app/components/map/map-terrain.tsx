"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Color,
  TextureLoader,
  Vector2,
  type Texture,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import type { ResolvedMapPerformance } from "./map-performance";
import {
  configureColorTexture,
  configureScalarTexture,
  configureTerrainNormalTexture,
} from "./map-texture-config";

type TerrainShader = {
  uniforms: Record<string, { value: unknown }>;
  fragmentShader: string;
};

export function MapTerrain({
  config,
  geometry,
  parchment,
  performance,
  onReady,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  performance: ResolvedMapPerformance;
  onReady?: () => void;
}) {
  const texturePaths = [
    config.textures.diffuse,
    config.textures.heightmap,
    config.textures.normalMap ??
      config.textures.heightmap,
    config.textures.landMask,
    config.textures.riversMask ??
      config.textures.landMask,
  ];

  const [
    surface,
    elevation,
    normal,
    landMask,
    rivers,
  ] = useLoader(
    TextureLoader,
    texturePaths,
  );

  const surfaceTexture = useMemo(
    () => configureColorTexture(surface),
    [surface],
  );

  const elevationTexture = useMemo(
    () => configureScalarTexture(elevation),
    [elevation],
  );

  const normalTexture = useMemo(
    () => configureTerrainNormalTexture(normal),
    [normal],
  );

  const landMaskTexture = useMemo(
    () => configureScalarTexture(landMask),
    [landMask],
  );

  const riversTexture = useMemo(
    () => configureScalarTexture(rivers),
    [rivers],
  );
  const shaderRef = useRef<TerrainShader | null>(null);

  const applyRiverMask = useCallback(
    (shader: TerrainShader) => {
      shaderRef.current = shader;
      shader.uniforms.terrainRiverMask = {
        value: riversTexture as Texture,
      };
      shader.uniforms.terrainRiverTime = {
        value: 0,
      };
      shader.uniforms.terrainRiverWater = {
        value: parchment ? 0 : 1,
      };
      shader.uniforms.terrainRiverColor = {
        value: new Color(config.palette.seaShallow),
      };
      shader.uniforms.terrainRiverDeepColor = {
        value: new Color(config.palette.seaDeep),
      };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          [
            "#include <common>",
            "uniform sampler2D terrainRiverMask;",
            "uniform float terrainRiverTime;",
            "uniform float terrainRiverWater;",
            "uniform vec3 terrainRiverColor;",
            "uniform vec3 terrainRiverDeepColor;",
          ].join("\n"),
        )
        .replace(
          "#include <alphamap_fragment>",
          [
            "#include <alphamap_fragment>",
            "float terrainRiverValue = texture2D(",
            "  terrainRiverMask,",
            "  vAlphaMapUv",
            ").r;",
            "float terrainRiverStrength = 1.0 - smoothstep(",
            "  0.56, 0.94, terrainRiverValue",
            ");",
            "terrainRiverStrength = pow(terrainRiverStrength, 1.35);",
            "float terrainRiverInk = terrainRiverStrength *",
            "  (1.0 - terrainRiverWater);",
            "diffuseColor.rgb *= 1.0 - terrainRiverInk * 0.3;",
            "float terrainFlowA = sin(",
            "  vAlphaMapUv.x * 118.0 +",
            "  vAlphaMapUv.y * 74.0 -",
            "  terrainRiverTime * 3.8",
            ");",
            "float terrainFlowB = sin(",
            "  vAlphaMapUv.x * -57.0 +",
            "  vAlphaMapUv.y * 143.0 -",
            "  terrainRiverTime * 2.6",
            ");",
            "float terrainFlow = clamp(",
            "  terrainFlowA * 0.62 + terrainFlowB * 0.38,",
            "  -1.0, 1.0",
            ");",
            "float terrainFlowLight = terrainFlow * 0.5 + 0.5;",
            "float terrainFlowFlash = pow(",
            "  smoothstep(0.62, 1.0, terrainFlowLight),",
            "  2.5",
            ");",
            "vec3 terrainRiverBaseColor = mix(",
            "  terrainRiverColor, terrainRiverDeepColor,",
            "  smoothstep(0.28, 0.82, terrainRiverStrength)",
            ");",
            "vec3 terrainAnimatedRiverColor = terrainRiverBaseColor *",
            "  mix(0.94, 1.08, terrainFlowLight);",
            "float terrainWaterBlend = terrainRiverStrength *",
            "  terrainRiverWater * 0.88;",
            "diffuseColor.rgb = mix(",
            "  diffuseColor.rgb,",
            "  terrainAnimatedRiverColor,",
            "  terrainWaterBlend",
            ");",
            "diffuseColor.rgb += vec3(0.035, 0.055, 0.05) *",
            "  terrainFlowFlash *",
            "  terrainRiverStrength * terrainRiverWater;",
          ].join("\n"),
        );
    },
    [
      config.palette.seaShallow,
      config.palette.seaDeep,
      parchment,
      riversTexture,
    ],
  );

  useFrame(({ clock }) => {
    const shader = shaderRef.current;
    const timeUniform =
      shader?.uniforms.terrainRiverTime;
    if (timeUniform) {
      // Three.js uniforms are mutable by design and are updated per frame.
      // eslint-disable-next-line react-hooks/immutability
      timeUniform.value = clock.elapsedTime;
    }
    const waterUniform =
      shader?.uniforms.terrainRiverWater;
    if (waterUniform) {
      // Keep the prewarmed material in sync when leaving parchment mode.
      waterUniform.value = parchment ? 0 : 1;
    }
  });

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
    Math.min(
      config.rendering?.segments ??
        256,
      performance.terrainSegments,
    );

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

  const normalScale = useMemo(
    () => new Vector2(0.72, 0.72),
    [],
  );

  useEffect(() => {
    onReady?.();
  }, [
    elevationTexture,
    landMaskTexture,
    normalTexture,
    onReady,
    riversTexture,
    surfaceTexture,
  ]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={performance.shadowMapSize > 0}
      castShadow={performance.shadowMapSize > 0}
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
        onBeforeCompile={applyRiverMask}
        customProgramCacheKey={() =>
          `terrain-rivers-water-v3:${parchment ? "parchment" : "dynamic"}:${config.textures.riversMask ?? "land-mask"}`
        }
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
        normalScale={normalScale}
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
