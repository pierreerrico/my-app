import type { ReactNode } from "react";

export type NationFactKind =
  | "officialName"
  | "language"
  | "capital"
  | "government"
  | "magic"
  | "technology"
  | "area"
  | "population"
  | "qualityOfLife";

export interface NationFact {
  kind: NationFactKind;
  label: string;
  value: string;
}

export interface NationAtlas {
  title: string;
  subtitle: string;
  facts: NationFact[];
  flavorText: ReactNode;
  map: ReactNode;
}

export type NavigationIconName =
  | "book"
  | "map"
  | "feather"
  | "compass"
  | "crown"
  | "hourglass"
  | "spark"
  | "paw"
  | "dice";

export interface NavigationItem {
  label: string;
  href: string;
  icon: NavigationIconName;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export interface EncyclopediaNavigation {
  title: string;
  subtitle: string;
  groups: NavigationGroup[];
  footer?: {
    badge: string;
    title: string;
    description: string;
  };
}

export interface NationLoreTheme {
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  burgundy: string;
  accent: string;
  accentStrong: string;
  accentBright: string;
  text: string;
  mutedText: string;
  panel: string;
  panelLight: string;
  panelWarm: string;
  panelInk: string;
  panelMuted: string;
  readingText: string;
}

export interface NationLorePageProps {
  atlas: NationAtlas;
  children: ReactNode;
  navigation?: EncyclopediaNavigation;
  theme?: Partial<NationLoreTheme>;
}
