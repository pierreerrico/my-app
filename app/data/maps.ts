export type MapCoordinates = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export type MapPlace = {
  id: string;
  name: string;
  kind: "capitale" | "città" | "porto" | "monumento" | "rovina";
  longitude: number;
  latitude: number;
  description: string;
  href?: string;
};

export type WorldMapConfig = {
  id: string;
  name: string;
  subtitle: string;
  texture: string;
  heightmap: string;
  landMask?: string;
  normalMap?: string;
  coordinates: MapCoordinates;
  maximumElevationKm: number;
  palette: {
    seaDeep: string;
    seaShallow: string;
    parchment: string;
    accent: string;
  };
  places: MapPlace[];
  rivers: {
    id: string;
    name?: string;
    points: [longitude: number, latitude: number, visualElevation: number][];
  }[];
};

export const selodiaMap: WorldMapConfig = {
  id: "selodia",
  name: "Arcontato di Selodia",
  subtitle: "Tavola geografica tridimensionale",
  texture: "/maps/selodia-atlas.png",
  heightmap: "/maps/selodia-heightmap.png",
  landMask: "/maps/selodia-land-mask.png",
  normalMap: "/maps/selodia-normal.png",
  // Span provvisorio ricavato dalla griglia della carta amministrativa.
  coordinates: {
    west: -1.65,
    east: 1.65,
    south: 36.5,
    north: 38.5,
  },
  maximumElevationKm: 4.3,
  palette: {
    seaDeep: "#123f55",
    seaShallow: "#2d8792",
    parchment: "#d8c8a9",
    accent: "#a87534",
  },
  // Aggiungi qui città e monumenti usando coordinate geografiche.
  // Esempio:
  // { id: "arsecori", name: "Arsecori", kind: "capitale",
  //   longitude: -0.12, latitude: 37.55,
  //   description: "Capitale dell’Arcontato." }
  places: [],
  // Tracciati iniziali ricavati dall’atlante. I nomi possono essere aggiunti in seguito.
  rivers: [
    {
      id: "fiume-01",
      points: [
        [-0.78, 37.92, 0.38],
        [-0.64, 37.82, 0.25],
        [-0.48, 37.69, 0.15],
        [-0.31, 37.57, 0.08],
      ],
    },
    {
      id: "fiume-02",
      points: [
        [-0.42, 37.89, 0.42],
        [-0.28, 37.75, 0.27],
        [-0.08, 37.63, 0.14],
        [0.12, 37.57, 0.07],
      ],
    },
    {
      id: "fiume-03",
      points: [
        [0.02, 37.63, 0.28],
        [0.18, 37.51, 0.18],
        [0.34, 37.39, 0.1],
        [0.52, 37.29, 0.055],
      ],
    },
    {
      id: "fiume-04",
      points: [
        [0.46, 37.38, 0.23],
        [0.62, 37.27, 0.16],
        [0.82, 37.16, 0.09],
        [1.02, 37.06, 0.045],
      ],
    },
    {
      id: "fiume-05",
      points: [
        [-1.03, 37.75, 0.25],
        [-1.12, 37.61, 0.15],
        [-1.05, 37.45, 0.08],
        [-0.91, 37.34, 0.04],
      ],
    },
  ],
};
