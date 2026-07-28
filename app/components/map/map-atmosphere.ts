import {
  Color,
  type ColorRepresentation,
} from "three";

import type { NationMapConfig } from "../../data/maps/types";

export type MapAtmosphereColors = {
  zenith: Color;
  horizon: Color;
  lower: Color;
};

/**
 * Unica sorgente cromatica per cielo e geometrie remote.
 * Condividere questi colori evita una cucitura visibile all'orizzonte.
 */
export function getMapAtmosphereColors(
  config: NationMapConfig,
): MapAtmosphereColors {
  const configuredHorizon =
    config.worldExtension
      ?.horizonColor ??
    config.oceanHorizon
      ?.horizonColor;

  return {
    horizon: configuredHorizon
      ? new Color(
          configuredHorizon as ColorRepresentation,
        )
      : new Color("#b7d8df"),
    zenith: new Color("#4d91b4"),
    lower: new Color("#8fbdca"),
  };
}
