"use client";

import { Html } from "@react-three/drei";
import {
  useFrame,
  useLoader,
} from "@react-three/fiber";
import {
  useMemo,
  useRef,
} from "react";
import {
  MathUtils,
  TextureLoader,
  Vector3,
} from "three";

import {
  geographicPointToPlane,
} from "../../data/maps/geography";
import type {
  DerivedMapGeometry,
  MapFeature,
  NationMapConfig,
} from "../../data/maps/types";
import {
  MapFeatureIcon,
} from "./map-feature-icons";

const MARKER_GROUND_OFFSET_KM = 0.006;

export function MapFeatureMarker({
  feature,
  config,
  geometry,
  selected,
  staticMode,
  onSelect,
}: {
  feature: MapFeature;
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
  selected: boolean;
  staticMode: boolean;
  onSelect: (feature: MapFeature) => void;
}) {
  const markerRef =
    useRef<HTMLButtonElement>(null);
  const projectedPosition =
    useMemo(() => new Vector3(), []);
  const [x, , z] =
    geographicPointToPlane(
      feature.position,
      geometry,
    );
  const elevationTexture = useLoader(
    TextureLoader,
    config.textures.heightmap,
  );
  const sampledElevationKm = useMemo(
    () =>
      sampleFeatureElevation(
        elevationTexture.image,
        feature,
        geometry,
        config.geography.heightmap
          .maximumElevationKm,
        config.geography.heightmap
          .seaLevel,
      ),
    [
      config.geography.heightmap
        .maximumElevationKm,
      config.geography.heightmap
        .seaLevel,
      elevationTexture.image,
      feature,
      geometry,
    ],
  );
  const exaggeration =
    config.rendering
      ?.elevationExaggeration ?? 2.5;
  const terrainElevation =
    (
      sampledElevationKm /
      geometry.kmPerPlaneUnit
    ) * exaggeration;
  const groundOffset =
    (
      MARKER_GROUND_OFFSET_KM /
      geometry.kmPerPlaneUnit
    ) * exaggeration;
  const worldY =
    terrainElevation + groundOffset;

  useFrame(({ camera, size }) => {
    const marker = markerRef.current;
    if (!marker) return;

    camera.updateMatrixWorld();
    projectedPosition
      .set(x, worldY, z)
      .project(camera);

    const screenX =
      (projectedPosition.x * 0.5 + 0.5) *
      size.width;
    const screenY =
      (-projectedPosition.y * 0.5 + 0.5) *
      size.height;
    const frameDepth = MathUtils.clamp(
      Math.min(size.width, size.height) * 0.054,
      38,
      58,
    );
    const atlasInset = frameDepth + 10;

    marker.hidden =
      screenX < atlasInset ||
      screenX > size.width - atlasInset ||
      screenY < atlasInset ||
      screenY > size.height - atlasInset ||
      projectedPosition.z < -1 ||
      projectedPosition.z > 1;
  });

  return (
    <group
      position={[
        x,
        worldY,
        z,
      ]}
    >
      <Html
        center
        distanceFactor={7}
        transform={false}
        zIndexRange={[5, 5]}
      >
        <button
          ref={markerRef}
          className={
            `map-feature-marker-control is-${feature.kind}${staticMode ? " is-static" : " is-pin"}${selected ? " is-selected" : ""}`
          }
          type="button"
          aria-label={`Apri ${feature.name}`}
          aria-pressed={selected}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => {
            onSelect(feature);
          }}
        >
          {staticMode && (
            <span
              className="map-feature-static-title"
              data-title={feature.name}
            >
              {feature.name}
            </span>
          )}
          {!staticMode && (
            <svg
              className="map-feature-pin-shape"
              viewBox="0 0 30 38"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={`map-pin-ivory-${feature.id}`}
                  x1="7"
                  y1="4"
                  x2="23"
                  y2="34"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop
                    offset="0"
                    stopColor="#fffdf8"
                  />
                  <stop
                    offset=".58"
                    stopColor="#eee2c9"
                  />
                  <stop
                    offset="1"
                    stopColor="#d9c39d"
                  />
                </linearGradient>
              </defs>
              <path
                fill={`url(#map-pin-ivory-${feature.id})`}
                d="M15 37C12.9 32.8 3 23.1 3 15A12 12 0 0 1 27 15c0 8.1-9.9 17.8-12 22Z"
              />
            </svg>
          )}
          {staticMode ? (
            <span className="map-feature-static-icon">
              <MapFeatureIcon
                kind={feature.kind}
              />
            </span>
          ) : (
            <MapFeatureIcon
              kind={feature.kind}
            />
          )}
        </button>
      </Html>
    </group>
  );
}

function sampleFeatureElevation(
  image: unknown,
  feature: MapFeature,
  geometry: DerivedMapGeometry,
  maximumElevationKm: number,
  seaLevel: number,
) {
  if (feature.elevationKm !== undefined) {
    return feature.elevationKm;
  }

  if (
    typeof document === "undefined" ||
    !(image instanceof HTMLImageElement) ||
    image.naturalWidth === 0 ||
    image.naturalHeight === 0
  ) {
    return 0;
  }

  const longitudeRatio =
    (
      feature.position.longitude -
      geometry.bounds.west
    ) /
    (
      geometry.bounds.east -
      geometry.bounds.west
    );
  const latitudeRatio =
    (
      geometry.bounds.north -
      feature.position.latitude
    ) /
    (
      geometry.bounds.north -
      geometry.bounds.south
    );
  const sourceX = Math.round(
    Math.min(
      1,
      Math.max(0, longitudeRatio),
    ) *
      (image.naturalWidth - 1),
  );
  const sourceY = Math.round(
    Math.min(
      1,
      Math.max(0, latitudeRatio),
    ) *
      (image.naturalHeight - 1),
  );
  const canvas =
    document.createElement("canvas");
  const context =
    canvas.getContext("2d", {
      willReadFrequently: true,
    });

  if (!context) {
    return 0;
  }

  canvas.width = 1;
  canvas.height = 1;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    1,
    1,
    0,
    0,
    1,
    1,
  );

  const heightValue =
    context.getImageData(
      0,
      0,
      1,
      1,
    ).data[0];
  const normalizedElevation =
    Math.max(
      0,
      (heightValue - seaLevel) /
        255,
    );

  return normalizedElevation *
    maximumElevationKm;
}
