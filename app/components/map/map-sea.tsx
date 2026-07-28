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
  type BufferGeometry,
  type Camera,
  type Group,
  PlaneGeometry,
  ShaderMaterial,
  type Material,
  type Scene,
  Texture,
  TextureLoader,
  Vector2,
  type WebGLRenderer,
} from "three";
import { Water as Water2 } from "three/examples/jsm/objects/Water2.js";

import type {
  DerivedMapGeometry,
  NationMapConfig,
} from "../../data/maps/types";
import { atlasWaterShader } from "./water/shaders/atlas-water-shader";
import type { ResolvedMapPerformance } from "./map-performance";
import {
  configureRepeatDetailTexture,
  configureRepeatNormalTexture,
  configureScalarTexture,
} from "./map-texture-config";

const DEFAULT_NORMAL_B =
  "/maps/shared/water-normal-b.jpg";

const FOAM_TEXTURE =
  "/maps/shared/foam.png";

const SHORE_FOAM_TEXTURE =
  "/maps/shared/foam-shore.png";

const WATER_FLOW_SPEED = 0.0085;

function resolveSecondNormalMap(
  firstPath: string,
): string {
  const derived = firstPath.replace(
    /water-normal-a(?=\.[a-z0-9]+$)/i,
    "water-normal-b",
  );

  return derived === firstPath
    ? DEFAULT_NORMAL_B
    : derived;
}

export function MapSea({
  config,
  geometry,
  parchment,
  currentMap,
  landMask,
  coastDistance,
  performance,
  onReady,
}: {
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  parchment: boolean;
  currentMap: Texture;
  landMask: Texture;
  coastDistance: Texture;
  performance: ResolvedMapPerformance;
  onReady?: () => void;
}) {
  const waterRef =
    useRef<Water2 | null>(null);
  const sea = config.seaRendering;

  if (!sea) {
    throw new Error(
      `La mappa "${config.id}" non definisce seaRendering.`,
    );
  }

  const normalMapBPath =
    sea.normalMapB ??
    resolveSecondNormalMap(
      sea.normalMapA,
    );

  const [
    normalASource,
    normalBSource,
    foamSource,
    shoreFoamSource,
  ] = useLoader(
    TextureLoader,
    [
      sea.normalMapA,
      normalMapBPath,
      FOAM_TEXTURE,
      SHORE_FOAM_TEXTURE,
    ],
  );

  const flowMap = useMemo(
    () => configureScalarTexture(currentMap),
    [currentMap],
  );

  const landMaskMap = useMemo(
    () => configureScalarTexture(landMask),
    [landMask],
  );

  const coastDistanceMap = useMemo(
    () => configureScalarTexture(coastDistance),
    [coastDistance],
  );

  const normalMap0 = useMemo(
    () => configureRepeatNormalTexture(normalASource),
    [normalASource],
  );

  const normalMap1 = useMemo(
    () => configureRepeatNormalTexture(normalBSource),
    [normalBSource],
  );

  const foamMap = useMemo(
    () => configureRepeatDetailTexture(foamSource),
    [foamSource],
  );

  const shoreFoamMap = useMemo(
    () => configureRepeatDetailTexture(shoreFoamSource),
    [shoreFoamSource],
  );

  const waterGeometry = useMemo(
    () => {
      const extensionScale =
        config.worldExtension?.mode === "ocean"
          ? Math.max(
              1,
              config.worldExtension.extensionScale ?? 1,
            )
          : 1;
      const segments =
        extensionScale > 1
          ? Math.min(
              64,
              Math.max(
                16,
                Math.ceil(extensionScale * 2),
              ),
            )
          : 1;
      const waterPlane = new PlaneGeometry(
        geometry.planeWidth * extensionScale,
        geometry.planeHeight * extensionScale,
        segments,
        segments,
      );
      const uv = waterPlane.attributes.uv;

      for (
        let index = 0;
        index < uv.count;
        index += 1
      ) {
        uv.setXY(
          index,
          (uv.getX(index) - 0.5) *
            extensionScale +
            0.5,
          (uv.getY(index) - 0.5) *
            extensionScale +
            0.5,
        );
      }
      uv.needsUpdate = true;

      return waterPlane;
    },
    [
      config.worldExtension,
      geometry.planeHeight,
      geometry.planeWidth,
    ],
  );

  const water = useMemo(() => {
    const instance = new Water2(
      waterGeometry,
      {
        shader: atlasWaterShader,

        color:
          sea.deepColor ??
          config.palette.seaDeep,

        textureWidth:
          performance.waterRenderTargetSize,
        textureHeight:
          performance.waterRenderTargetSize,
        clipBias: 0.003,

        flowMap,
        flowDirection: new Vector2(1, 0),
        flowSpeed: WATER_FLOW_SPEED,

        reflectivity: 0.075,
        scale: 34,

        normalMap0,
        normalMap1,
      },
    );

    const material =
      instance.material as ShaderMaterial;

    material.depthWrite = true;
    material.depthTest = true;
    material.transparent = false;

    material.uniforms
      .reflectionStrength
      .value = 0.18;

    material.uniforms
      .refractionStrength
      .value = 0.74;

    material.uniforms
      .normalStrength
      .value = 0.62;

    material.uniforms
      .refractionBlurStrength
      .value = 2.10;

    material.uniforms
      .refractionTexelSize
      .value.set(
        1 /
          performance.waterRenderTargetSize,
        1 /
          performance.waterRenderTargetSize,
      );

    material.uniforms
      .tCoastDistance
      .value = coastDistanceMap;

    material.uniforms
      .tLandMask
      .value = landMaskMap;

    material.uniforms
      .tFoamTexture
      .value = foamMap;

    material.uniforms
      .tShoreTexture
      .value = shoreFoamMap;

    const coastImage =
      coastDistance.image as
        | {
            width?: number;
            height?: number;
          }
        | undefined;

    const coastWidth = Math.max(
      coastImage?.width ?? 2048,
      1,
    );

    const coastHeight = Math.max(
      coastImage?.height ?? 1152,
      1,
    );

    material.uniforms
      .mapTexelSize
      .value.set(
        1 / coastWidth,
        1 / coastHeight,
      );

    material.uniforms
      .foamColor
      .value.set(
        sea.foamColor ??
          "#eef8f3",
      );

    material.uniforms
      .foamIntensity
      .value = Math.min(
        sea.foamStrength ?? 0.82,
        1.25,
      );

    /*
     * Texture detail moves at Water2's same low constant speed. The shader
     * independently spawns each front offshore, moves it toward the coast,
     * thickens it during the approach and fades it completely on arrival.
     */
    material.uniforms
      .foamTiling
      .value.set(4.8, 1.85);

    material.uniforms
      .foamRanges
      .value.set(0.020, 0.235);

    material.uniforms
      .foamSpeed
      .value = WATER_FLOW_SPEED;

    /*
     * The shoreward lifecycle is deliberately independent from Water2's UV
     * flow. The value remains unchanged so the approved movement timing is
     * preserved; the shader converts it from angular speed to cycle progress.
     */
    material.uniforms
      .foamPushPullSpeed
      .value = 0.39;

    /*
     * Gap morphology is deliberately slower than the shoreward lifecycle. This
     * keeps the interruptions alive without making the mask sweep visibly
     * across the entire shoreline.
     */
    material.uniforms
      .foamGapSpeed
      .value = 0.105;

    /*
     * All three fronts remain 50% thinner than the earlier wide version.
     * The offshore fronts remain progressively thinner, while the shader
     * preserves broad local variation along each individual line.
     */
    material.uniforms
      .foamLineWidths
      .value.set(
        0.0240,
        0.0150,
        0.0085,
      );

    material.uniforms
      .foamImpactStrength
      .value = 0.34;

    const worldExtension =
      config.worldExtension ??
      config.oceanHorizon;
    material.uniforms
      .edgeBlendColor
      .value.set(
        worldExtension
          ?.deepWaterColor ??
          sea.deepColor ??
          config.palette.seaDeep,
      );
    material.uniforms
      .edgeFadeWidth
      .value = 0;

    instance.name =
      `${config.id}-water-open-source-port`;

    instance.rotation.x =
      -Math.PI / 2;

    instance.position.set(
      0,
      0,
      0,
    );

    instance.renderOrder = -20;
    instance.frustumCulled = false;
    instance.receiveShadow = false;

    /*
     * Water2 ridisegna l'intera scena due volte per riflessione e rifrazione.
     * Nei profili non massimi aggiorniamo quei render target meno spesso,
     * continuando però ad animare normali, correnti e schiuma ogni frame.
     */
    const reflectionStride =
      performance.mode === "quality"
        ? 1
        : performance.mode ===
            "balanced"
          ? 3
          : 4;
    const renderReflection =
      instance.onBeforeRender.bind(
        instance,
      );
    let reflectionFrame = 0;
    instance.onBeforeRender = (
      renderer: WebGLRenderer,
      scene: Scene,
      camera: Camera,
      geometryToRender:
        BufferGeometry,
      materialToRender: Material,
      group: Group,
    ) => {
      reflectionFrame += 1;
      if (
        reflectionFrame %
          reflectionStride !==
        0
      ) {
        return;
      }
      renderReflection(
        renderer,
        scene,
        camera,
        geometryToRender,
        materialToRender,
        group,
      );
    };

    return instance;
  }, [
    coastDistance.image,
    coastDistanceMap,
    config.id,
    config.palette.seaDeep,
    config.oceanHorizon,
    config.worldExtension,
    flowMap,
    foamMap,
    landMaskMap,
    normalMap0,
    normalMap1,
    performance.waterRenderTargetSize,
    performance.mode,
    sea.deepColor,
    sea.foamColor,
    sea.foamStrength,
    shoreFoamMap,
    waterGeometry,
  ]);

  useEffect(() => {
    onReady?.();
  }, [onReady, water]);

  useFrame((state) => {
    const activeWater =
      waterRef.current;
    if (
      !activeWater ||
      !activeWater.visible
    ) {
      return;
    }
    const material =
      activeWater.material as ShaderMaterial;

    material.uniforms.time.value =
      state.clock.elapsedTime;

    const mapRadius =
      Math.hypot(
        geometry.planeWidth,
        geometry.planeHeight,
      ) * 0.5;
    const cameraDistance =
      state.camera.position.length();
    const visibilityStart = mapRadius * 0.72;
    const visibilityEnd = mapRadius * 1.65;
    const visibilityRange = Math.max(
      visibilityEnd - visibilityStart,
      0.0001,
    );
    const distanceProgress = Math.min(
      Math.max(
        (cameraDistance - visibilityStart) /
          visibilityRange,
        0,
      ),
      1,
    );
    const smoothDistance =
      distanceProgress *
      distanceProgress *
      (3 - 2 * distanceProgress);
    material.uniforms.foamVisibility.value =
      1 - smoothDistance;
  }, -19);

  useEffect(
    () => () => {
      water.material.dispose();
      waterGeometry.dispose();
    },
    [
      coastDistanceMap,
      flowMap,
      foamMap,
      landMaskMap,
      normalMap0,
      normalMap1,
      shoreFoamMap,
      water,
      waterGeometry,
    ],
  );

  return (
    <primitive
      ref={waterRef}
      object={water}
      visible={!parchment}
    />
  );
}
