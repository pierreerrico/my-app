import { MathUtils, Vector3 } from "three";

import type { DerivedMapGeometry } from "../../data/maps/types";

/**
 * Direzione del Sole al mezzogiorno solare dell'equinozio.
 *
 * All'equinozio la declinazione solare è 0°, quindi l'altezza
 * sull'orizzonte è 90° - |latitudine|. Nell'emisfero nord il Sole
 * culmina a sud; nell'emisfero sud culmina a nord.
 */
export function getEquinoxNoonSunDirection(
  geometry: DerivedMapGeometry,
): Vector3 {
  const latitude = MathUtils.clamp(
    geometry.center.latitude,
    -90,
    90,
  );
  const altitude = MathUtils.degToRad(
    90 - Math.abs(latitude),
  );
  const southward =
    latitude >= 0 ? 1 : -1;

  return new Vector3(
    0,
    Math.sin(altitude),
    Math.cos(altitude) * southward,
  ).normalize();
}
