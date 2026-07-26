import type {
  DerivedMapGeometry,
  GeographicPoint,
  MapBounds,
  NationMapConfig,
} from "./types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * Calcola tutti i dati geografici derivati partendo da:
 *
 * - larghezza della carta;
 * - altezza della carta;
 * - coordinata dell’angolo nord-occidentale;
 * - raggio del pianeta;
 * - analisi della heightmap.
 */
export function deriveMapGeometry(
  config: NationMapConfig,
): DerivedMapGeometry {
  const { geography } = config;

  if (geography.mapWidthKm <= 0) {
    throw new Error(
      `La larghezza della mappa "${config.id}" deve essere maggiore di zero.`,
    );
  }

  if (geography.mapHeightKm <= 0) {
    throw new Error(
      `L’altezza della mappa "${config.id}" deve essere maggiore di zero.`,
    );
  }

  if (geography.planetRadiusKm <= 0) {
    throw new Error(
      `Il raggio planetario della mappa "${config.id}" deve essere maggiore di zero.`,
    );
  }

  const planeHeight = config.rendering?.planeHeight ?? 9.9;

  const planeWidth =
    planeHeight *
    (geography.mapWidthKm / geography.mapHeightKm);

  const kmPerPlaneUnit =
    geography.mapHeightKm / planeHeight;

  /*
   * L’angolo in alto a sinistra definisce:
   *
   * north = latitudine superiore
   * west  = longitudine occidentale
   */
  const north = geography.topLeft.latitude;
  const west = geography.topLeft.longitude;

  /*
   * Distanza verticale lungo la superficie del pianeta:
   *
   * arco = raggio × angolo
   * angolo = arco / raggio
   */
  const latitudeSpanDegrees =
    (geography.mapHeightKm / geography.planetRadiusKm) *
    RAD_TO_DEG;

  const south = north - latitudeSpanDegrees;

  /*
   * La proiezione rettangolare locale è ancorata all'angolo
   * nord-occidentale. La scala longitudinale deve quindi essere calcolata
   * alla latitudine del punto d'origine: dimensioni della carta e coordinata
   * superiore sinistra determinano così tutta la griglia.
   */
  const anchorLatitudeRadians =
    north * DEG_TO_RAD;

  const parallelRadius =
    geography.planetRadiusKm *
    Math.cos(anchorLatitudeRadians);

  if (Math.abs(parallelRadius) < 1e-8) {
    throw new Error(
      `La mappa "${config.id}" è troppo vicina a un polo per usare questa proiezione rettangolare.`,
    );
  }

  const longitudeSpanDegrees =
    (geography.mapWidthKm / parallelRadius) *
    RAD_TO_DEG;

  const east = west + longitudeSpanDegrees;

  const bounds: MapBounds = {
    west,
    east,
    south,
    north,
  };

  const center: GeographicPoint = {
    latitude: (north + south) / 2,
    longitude: (west + east) / 2,
  };

  const mapAreaKm2 =
    geography.mapWidthKm *
    geography.mapHeightKm;

  return {
    bounds,
    center,

    mapAreaKm2,

    territoryAreaKm2:
      geography.analysis?.territoryAreaKm2,

    landCoverageRatio:
      geography.analysis?.landCoverageRatio,

    planeWidth,
    planeHeight,
    kmPerPlaneUnit,

    latitudeSpanDegrees,
    longitudeSpanDegrees,
  };
}

/**
 * Converte una coordinata geografica in una posizione sul piano Three.js.
 */
export function geographicPointToPlane(
  point: GeographicPoint,
  geometry: DerivedMapGeometry,
): [x: number, y: number, z: number] {
  const {
    bounds,
    planeWidth,
    planeHeight,
  } = geometry;

  const longitudeSpan =
    bounds.east - bounds.west;

  const latitudeSpan =
    bounds.north - bounds.south;

  if (longitudeSpan === 0 || latitudeSpan === 0) {
    throw new Error(
      "Impossibile convertire la coordinata: i limiti geografici della carta non sono validi.",
    );
  }

  const xRatio =
    (point.longitude - bounds.west) /
    longitudeSpan;

  const zRatio =
    (bounds.north - point.latitude) /
    latitudeSpan;

  return [
    (xRatio - 0.5) * planeWidth,
    0,
    (zRatio - 0.5) * planeHeight,
  ];
}

/**
 * Sceglie un intervallo leggibile per griglie e scale.
 *
 * Esempi:
 * 0,1 – 0,2 – 0,5 – 1 – 2 – 5 – 10 – 20...
 */
export function chooseNiceStep(
  span: number,
  targetIntervals = 5,
): number {
  if (!Number.isFinite(span) || span <= 0) {
    return 1;
  }

  if (
    !Number.isFinite(targetIntervals) ||
    targetIntervals <= 0
  ) {
    return span;
  }

  const rawStep =
    span / targetIntervals;

  const magnitude =
    10 ** Math.floor(Math.log10(rawStep));

  const normalizedStep =
    rawStep / magnitude;

  const multiplier =
    NICE_STEPS.find(
      (candidate) => candidate >= normalizedStep,
    ) ?? 10;

  return multiplier * magnitude;
}

/**
 * Restituisce tutti i valori multipli di step compresi nei limiti.
 */
export function valuesWithinBounds(
  minimum: number,
  maximum: number,
  step: number,
): number[] {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    !Number.isFinite(step) ||
    step <= 0 ||
    minimum > maximum
  ) {
    return [];
  }

  const first =
    Math.ceil((minimum - 1e-10) / step) *
    step;

  const values: number[] = [];

  for (
    let value = first;
    value <= maximum + 1e-10;
    value += step
  ) {
    values.push(
      Number(value.toFixed(10)),
    );
  }

  return values;
}

/**
 * Sceglie automaticamente la lunghezza della barra di scala.
 */
export function chooseScaleDistance(
  mapWidthKm: number,
): number {
  const desiredDistance =
    mapWidthKm * 0.24;

  return chooseNiceStep(
    desiredDistance,
    1,
  );
}

/**
 * Formatta una coordinata con la direzione geografica corretta.
 */
export function formatCoordinate(
  value: number,
  axis: "latitude" | "longitude",
): string {
  const absoluteValue =
    Math.abs(value);

  const decimals =
    absoluteValue < 1
      ? 2
      : absoluteValue < 10
        ? 1
        : 0;

  const formattedValue =
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(absoluteValue);

  if (Math.abs(value) < 1e-9) {
    return "0°";
  }

  const direction =
    axis === "latitude"
      ? value > 0
        ? "N"
        : "S"
      : value > 0
        ? "E"
        : "O";

  return `${formattedValue}° ${direction}`;
}
