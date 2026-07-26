"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";
import type {
  MapFeature,
} from "../../data/maps/types";
import {
  MapFeatureIcon,
} from "./map-feature-icons";
import {
  Sidebar,
} from "../sidebar/sidebar";
import {
  CircleControl,
} from "../nation-lore/circle-control";

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
  const [portalTarget, setPortalTarget] =
    useState<Element | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(
      () => {
        setPortalTarget(
          document.querySelector(
            ".nation-lore-page",
          ),
        );
      },
    );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <Sidebar
      id="map-feature-info"
      open={Boolean(feature)}
      side="right"
      variant="feature"
      label={
        feature
          ? `le informazioni su ${feature.name}`
          : "le informazioni sul luogo"
      }
      className="map-feature-sidebar"
      onClose={onClose}
    >
      {feature && (
        <div className="nation-atlas-sidebar-content map-feature-sidebar-content">
          <CircleControl
            className="map-feature-sidebar-close"
            type="button"
            icon="info"
            active
            onClick={onClose}
            aria-label="Chiudi le informazioni sul luogo"
          />

          <header>
            <span className="map-feature-sidebar-icon">
              <MapFeatureIcon
                kind={feature.kind}
              />
            </span>
            <h1>{feature.name}</h1>
            <p>{FEATURE_LABELS[feature.kind]}</p>
          </header>

          <div
            className="nation-separator"
            aria-hidden="true"
          >
            <span />
          </div>

          <dl className="nation-facts">
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
            <div className="nation-flavor">
              {feature.description}
            </div>
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
    </Sidebar>,
    portalTarget,
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
