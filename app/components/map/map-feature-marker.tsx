"use client";

import { Html } from "@react-three/drei";

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

const FEATURE_LABELS: Record<
  MapFeature["kind"],
  string
> = {
  capital: "Capitale",
  city: "Città",
  town: "Centro urbano",
  village: "Villaggio",
  port: "Porto",
  forest: "Foresta",
  mountain: "Montagna",
  volcano: "Vulcano",
  lake: "Lago",
  river: "Fiume",
  ruin: "Rovina",
  monument: "Monumento",
  fortress: "Fortezza",
  mine: "Miniera",
  landmark: "Luogo notevole",
};

export function MapFeatureMarker({
  feature,
  config,
  geometry,
}: {
  feature: MapFeature;
  config: NationMapConfig;
  geometry: DerivedMapGeometry;
}) {
  const [x, , z] =
    geographicPointToPlane(
      feature.position,
      geometry,
    );

  const maximumElevationKm =
    config.geography.heightmap
      .maximumElevationKm;

  const elevationExaggeration =
    config.rendering
      ?.elevationExaggeration ??
    2.5;

  const featureElevation =
    feature.elevationKm !== undefined &&
    maximumElevationKm > 0
      ? (
          feature.elevationKm /
          geometry.kmPerPlaneUnit
        ) *
        elevationExaggeration
      : 0.18;

  return (
    <group
      position={[
        x,
        featureElevation + 0.12,
        z,
      ]}
    >
      <Html
        center
        distanceFactor={7}
        transform={false}
      >
        <a
          className={
            `map-feature-marker is-${feature.kind}`
          }
          href={feature.href}
          onClick={(event) => {
            if (!feature.href) {
              event.preventDefault();
            }
          }}
          aria-label={
            `${FEATURE_LABELS[feature.kind]}: ${feature.name}`
          }
        >
          <span className="map-feature-marker-icon">
            {feature.icon ?? (
              <MapFeatureIcon
                kind={feature.kind}
              />
            )}
          </span>

          <span className="map-feature-label">
            <small>
              {FEATURE_LABELS[feature.kind]}
            </small>

            <strong>
              {feature.name}
            </strong>

            {feature.description && (
              <p>
                {feature.description}
              </p>
            )}
          </span>
        </a>
      </Html>
    </group>
  );
}