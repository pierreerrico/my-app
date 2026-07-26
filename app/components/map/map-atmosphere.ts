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
  const seaBase = new Color(
    config.palette.seaDeep,
  );
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
      : seaBase
          .clone()
          .lerp(
            new Color("#9ed5df"),
            0.68,
          ),
    zenith: seaBase
      .clone()
      .lerp(
        new Color("#17384f"),
        0.42,
      ),
    lower: seaBase
      .clone()
      .multiplyScalar(0.42),
  };
}
