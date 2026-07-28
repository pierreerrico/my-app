"use client";

import { useEffect, useMemo } from "react";
import {
  Color,
  MeshStandardMaterial,
  Texture,
} from "three";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import type { ResolvedMapPerformance } from "./map-performance";
import { configureScalarTexture } from "./map-texture-config";

const DEFAULT_SEABED_SEGMENTS = 256;
const DEFAULT_SEABED_DEPTH = 0.22;
const SEABED_TOP_OFFSET = -0.018;

/**
 * La bathymetry descrive soltanto la geometria del fondale.
 * La coast-distance descrive soltanto la sua colorazione.
 */
type SeabedShaderUniforms = {
  tSeabedCoastDistance: { value: Texture };
  seabedCoastColor: { value: Color };
  seabedShelfColor: { value: Color };
  seabedOceanColor: { value: Color };
  seabedFarOceanColor: { value: Color };
  seabedEdgeColor: { value: Color };
  seabedEdgeFadeWidth: { value: number };
};

type SeabedMaterial = MeshStandardMaterial & {
  userData: {
    seabedUniforms?: SeabedShaderUniforms;
  };
};

function buildSeabedColors(
  config: NationMapConfig,
): {
  coast: Color;
  shelf: Color;
  ocean: Color;
  farOcean: Color;
} {
  const sea = config.seaRendering;

  if (!sea) {
    throw new Error(
      `La mappa "${config.id}" non definisce seaRendering.`,
    );
  }

  const coast = new Color(
    sea.shallowColor ??
      config.palette.seaShallow,
  );

  const shelf = new Color(
    sea.midColor ??
      sea.shallowColor ??
      config.palette.seaShallow,
  );

  const ocean = new Color(
    sea.deepColor ??
      config.palette.seaDeep,
  );

  /*
   * Il mare più lontano resta nella stessa famiglia cromatica
   * dell'ocean color: viene solo reso più profondo e meno saturo.
   */
  const farOcean = ocean
    .clone()
    .lerp(
      new Color(config.palette.seaDeep),
      0.58,
    )
    .multiplyScalar(0.76);

  return {
    coast,
    shelf,
    ocean,
    farOcean,
  };
}

function createSeabedMaterial(
  bathymetry: Texture,
  coastDistance: Texture,
  config: NationMapConfig,
): SeabedMaterial {
  const colors = buildSeabedColors(config);

  const material = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.94,
    metalness: 0,

    /*
     * La bathymetry viene usata esclusivamente qui.
     * Bianco = fondale vicino al livello del mare.
     * Nero = fondale profondo.
     */
    displacementMap: bathymetry,
    displacementScale: DEFAULT_SEABED_DEPTH,
    displacementBias: -DEFAULT_SEABED_DEPTH,
  }) as SeabedMaterial;

  const uniforms: SeabedShaderUniforms = {
    tSeabedCoastDistance: {
      value: coastDistance,
    },
    seabedCoastColor: {
      value: colors.coast,
    },
    seabedShelfColor: {
      value: colors.shelf,
    },
    seabedOceanColor: {
      value: colors.ocean,
    },
    seabedFarOceanColor: {
      value: colors.farOcean,
    },
    seabedEdgeColor: {
      value: new Color(
        config.worldExtension
          ?.horizonColor ??
          config.palette.background ??
          config.palette.seaDeep,
      )
        .lerp(
          new Color(
            config.worldExtension
              ?.deepWaterColor ??
              config.seaRendering
                ?.deepColor ??
              config.palette.seaDeep,
          ),
          0.46,
        )
        .multiplyScalar(0.42),
    },
    seabedEdgeFadeWidth: {
      value:
        !config.worldExtension ||
        config.worldExtension.mode ===
          "ocean"
          ? Math.max(
              0.04,
              config.worldExtension
                ?.transitionWidth ??
                config.oceanHorizon
                  ?.transitionWidth ??
                0.14,
            )
          : 0,
    },
  };

  material.userData.seabedUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tSeabedCoastDistance =
      uniforms.tSeabedCoastDistance;
    shader.uniforms.seabedCoastColor =
      uniforms.seabedCoastColor;
    shader.uniforms.seabedShelfColor =
      uniforms.seabedShelfColor;
    shader.uniforms.seabedOceanColor =
      uniforms.seabedOceanColor;
    shader.uniforms.seabedFarOceanColor =
      uniforms.seabedFarOceanColor;
    shader.uniforms.seabedEdgeColor =
      uniforms.seabedEdgeColor;
    shader.uniforms.seabedEdgeFadeWidth =
      uniforms.seabedEdgeFadeWidth;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
          #include <common>

          varying vec2 vSeabedUv;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
          #include <begin_vertex>

          vSeabedUv = uv;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `
          #include <common>

          uniform sampler2D tSeabedCoastDistance;
          uniform vec3 seabedCoastColor;
          uniform vec3 seabedShelfColor;
          uniform vec3 seabedOceanColor;
          uniform vec3 seabedFarOceanColor;
          uniform vec3 seabedEdgeColor;
          uniform float seabedEdgeFadeWidth;

          varying vec2 vSeabedUv;

          vec3 getSeabedCoastGradient(
            float coastDistanceSample
          ) {
            /*
             * La coast-distance di Selodia è codificata così:
             * 0 = costa / terra vicina
             * 1 = mare più lontano.
             *
             * La texture viene quindi usata direttamente come
             * distanza dalla costa. La potenza rende più ampia e
             * morbida la fascia tropicale senza invertirne il verso.
             */
            float distanceFromCoast =
              pow(
                clamp(
                  coastDistanceSample,
                  0.0,
                  1.0
                ),
                1.20
              );

            vec3 coastToShelf = mix(
              seabedCoastColor,
              seabedShelfColor,
              smoothstep(
                0.02,
                0.24,
                distanceFromCoast
              )
            );

            vec3 shelfToOcean = mix(
              seabedShelfColor,
              seabedOceanColor,
              smoothstep(
                0.16,
                0.62,
                distanceFromCoast
              )
            );

            vec3 tropicalToOcean = mix(
              coastToShelf,
              shelfToOcean,
              smoothstep(
                0.12,
                0.44,
                distanceFromCoast
              )
            );

            return mix(
              tropicalToOcean,
              seabedFarOceanColor,
              smoothstep(
                0.64,
                1.0,
                distanceFromCoast
              )
            );
          }
        `,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        /* glsl */ `
          float coastDistanceSample =
            texture2D(
              tSeabedCoastDistance,
              vSeabedUv
            ).r;

          vec3 seabedColor =
            getSeabedCoastGradient(
              coastDistanceSample
            );

          vec2 seabedEdgeCoordinates =
            abs(vSeabedUv - 0.5) * 2.0;
          float seabedEdgeDistance = max(
            seabedEdgeCoordinates.x,
            seabedEdgeCoordinates.y
          );
          float seabedEdgeBlend = smoothstep(
            1.0 - max(
              seabedEdgeFadeWidth,
              0.001
            ),
            1.0,
            seabedEdgeDistance
          );
          seabedColor = mix(
            seabedColor,
            seabedEdgeColor,
            seabedEdgeBlend *
              seabedEdgeBlend *
              step(
                0.001,
                seabedEdgeFadeWidth
              )
          );

          vec4 diffuseColor =
            vec4(
              seabedColor,
              opacity
            );
        `,
      );
  };

  material.customProgramCacheKey = () =>
    `${config.id}-seabed-coast-distance-v3`;

  material.needsUpdate = true;

  return material;
}

export function MapSeabed({
  config,
  geometry,
  parchment,
  bathymetry,
  coastDistance,
  performance,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  bathymetry: Texture;
  coastDistance: Texture;
  performance: ResolvedMapPerformance;
}) {
  const bathymetryTexture = useMemo(
    () => configureScalarTexture(bathymetry),
    [bathymetry],
  );

  const coastDistanceTexture = useMemo(
    () => configureScalarTexture(coastDistance),
    [coastDistance],
  );

  const material = useMemo(
    () =>
      createSeabedMaterial(
        bathymetryTexture,
        coastDistanceTexture,
        config,
      ),
    [
      bathymetryTexture,
      coastDistanceTexture,
      config,
    ],
  );

  const horizontalSegments =
    Math.min(
      config.rendering?.segments ??
        DEFAULT_SEABED_SEGMENTS,
      performance.terrainSegments,
    );

  const mapAspectRatio =
    geometry.planeWidth /
    geometry.planeHeight;

  const verticalSegments = Math.max(
    2,
    Math.round(
      horizontalSegments /
        mapAspectRatio,
    ),
  );

  useEffect(
    () => () => {
      material.dispose();
    },
    [
      bathymetryTexture,
      coastDistanceTexture,
      material,
    ],
  );

  if (parchment) {
    return null;
  }

  return (
    <mesh
      name={`${config.id}-seabed`}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SEABED_TOP_OFFSET, 0]}
      receiveShadow={false}
      castShadow={false}
      renderOrder={-30}
      frustumCulled={false}
    >
      <planeGeometry
        args={[
          geometry.planeWidth,
          geometry.planeHeight,
          horizontalSegments,
          verticalSegments,
        ]}
      />

      <primitive
        object={material}
        attach="material"
      />
    </mesh>
  );
}
