"use client";

import type {
  MapFeature,
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

export function MapFeatureSidebar({
  feature,
  onClose,
}: {
  feature: MapFeature | null;
  onClose: () => void;
}) {
  return (
    <aside
      className={
        `map-feature-sidebar${feature ? " is-open" : ""}`
      }
      aria-hidden={!feature}
      aria-label={
        feature
          ? `Informazioni su ${feature.name}`
          : "Informazioni sul luogo"
      }
    >
      {feature && (
        <div className="map-feature-sidebar-content">
          <button
            className="nation-panel-close map-feature-sidebar-close"
            type="button"
            onClick={onClose}
            aria-label="Chiudi le informazioni sul luogo"
          >
            ×
          </button>

          <header>
            <span className="map-feature-sidebar-icon">
              <MapFeatureIcon
                kind={feature.kind}
              />
            </span>
            <small>
              {FEATURE_LABELS[feature.kind]}
            </small>
            <h2>{feature.name}</h2>
          </header>

          <div
            className="nation-separator"
            aria-hidden="true"
          >
            <span />
          </div>

          <dl>
            <div>
              <dt>Latitudine</dt>
              <dd>
                {formatCoordinate(
                  feature.position.latitude,
                  "latitude",
                )}
              </dd>
            </div>
            <div>
              <dt>Longitudine</dt>
              <dd>
                {formatCoordinate(
                  feature.position.longitude,
                  "longitude",
                )}
              </dd>
            </div>
            {feature.elevationKm !==
              undefined && (
              <div>
                <dt>Altitudine</dt>
                <dd>
                  {formatElevation(
                    feature.elevationKm,
                  )}
                </dd>
              </div>
            )}
          </dl>

          {feature.description && (
            <p>{feature.description}</p>
          )}

          {feature.href && (
            <a
              className="map-feature-sidebar-link"
              href={feature.href}
            >
              Apri la voce completa
            </a>
          )}
        </div>
      )}
    </aside>
  );
}

function formatCoordinate(
  value: number,
  axis: "latitude" | "longitude",
) {
  const positive =
    axis === "latitude" ? "N" : "E";
  const negative =
    axis === "latitude" ? "S" : "O";

  return `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;
}

function formatElevation(
  elevationKm: number,
) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(elevationKm * 1000) + " m";
}
