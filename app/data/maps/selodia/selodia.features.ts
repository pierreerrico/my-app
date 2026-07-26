import type { MapFeature } from "../types";

export const selodiaFeatures: MapFeature[] = [
  {
    id: "arsecori",
    name: "Arsecori",
    kind: "capital",
    position: {
      latitude: 39.48,
      longitude: 0.04,
    },
    description: "Capitale dell’Arcontato di Selodia.",
  },
  {
    id: "monte-nivo",
    name: "Monte Nivo",
    kind: "mountain",
    position: {
      latitude: 37.72,
      longitude: 0.28,
    },
    elevationKm: 4.326,
  },
];