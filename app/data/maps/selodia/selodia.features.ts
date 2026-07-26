import type { MapFeature } from "../types";

export const selodiaFeatures: MapFeature[] = [
  {
    id: "arsecori",
    name: "Arsecori",
    kind: "capital",
    position: {
      latitude: 39.55,
      longitude: -0.02,
    },
    description: "Capitale dell’Arcontato di Selodia.",
  },
  {
    id: "cello",
    name: "Cello",
    kind: "city",
    position: {
      latitude: 39.36,
      longitude: -0.66,
    },
    description: "Città di Selodia.",
  },
  {
    id: "frasseno",
    name: "Frasseno",
    kind: "city",
    position: {
      latitude: 39.93,
      longitude: -0.99,
    },
    description: "Città di Selodia.",
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