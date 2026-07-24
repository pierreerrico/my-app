import type { ReactNode, SVGProps } from "react";
import type { MapFeatureKind } from "../../data/maps/types";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

const icons: Record<MapFeatureKind, (props: IconProps) => ReactNode> = {
  capital: (props) => (
    <BaseIcon {...props}>
      <path d="M4 26h24M7 24V12l9-7 9 7v12M11 24v-7h10v7M10 11h12M16 5v6" />
      <circle cx="16" cy="4" r="1.5" />
    </BaseIcon>
  ),
  city: (props) => (
    <BaseIcon {...props}>
      <path d="M3 27h26M6 27V12h7v15M13 27V7h8v20M21 27V15h6v12M9 16h1M9 20h1M16 11h2M16 15h2M16 19h2M24 19h1M24 23h1" />
    </BaseIcon>
  ),
  town: (props) => (
    <BaseIcon {...props}>
      <path d="M3 27h26M6 27V16l6-5 6 5v11M17 27V12l5-4 5 4v15M9 27v-6h6v6M21 16h2M21 20h2" />
    </BaseIcon>
  ),
  village: (props) => (
    <BaseIcon {...props}>
      <path d="M3 27h26M5 27V18l5-4 5 4v9M17 27V15l5-4 5 4v12M8 27v-5h4v5M20 27v-6h4v6" />
    </BaseIcon>
  ),
  port: (props) => (
    <BaseIcon {...props}>
      <path d="M16 4v20M11 8h10M7 15a9 9 0 0 0 18 0M7 15H3l4-5 4 5H7M25 15h4l-4-5-4 5h4" />
    </BaseIcon>
  ),
  forest: (props) => (
    <BaseIcon {...props}>
      <path d="M7 26v-6M3 21l4-7 4 7H3M5 16l2-5 2 5M18 27v-8M12 20l6-11 6 11H12M15 14l3-7 3 7M26 27v-5M22 23l4-8 4 8h-8" />
    </BaseIcon>
  ),
  mountain: (props) => (
    <BaseIcon {...props}>
      <path d="M2 27 11 9l5 8 4-7 10 17H2Z" />
      <path d="m8 15 3-6 3.2 5.2L12 13l-2 3M17.5 14.5 20 10l3 5-2-1-2 2" />
    </BaseIcon>
  ),
  volcano: (props) => (
    <BaseIcon {...props}>
      <path d="M2 27 11 12h10l9 15H2Z" />
      <path d="M11 12c2 2 8 2 10 0M13 8c-2-2 1-4 3-2 0-3 5-3 5 0 3-1 5 2 3 4" />
    </BaseIcon>
  ),
  lake: (props) => (
    <BaseIcon {...props}>
      <path d="M3 18c4-3 7 3 11 0s7 3 11 0 4 1 4 1M3 23c4-3 7 3 11 0s7 3 11 0 4 1 4 1M7 13c2-3 4-4 7-4 4 0 6 2 9 5" />
    </BaseIcon>
  ),
  river: (props) => (
    <BaseIcon {...props}>
      <path d="M8 3c8 5-2 9 6 14s1 8 8 12M15 3c5 4-3 8 4 12s0 8 6 11" />
    </BaseIcon>
  ),
  ruin: (props) => (
    <BaseIcon {...props}>
      <path d="M4 27h24M7 27V10h5v17M15 27V6h5v21M23 27V13h4v14M6 10h7M14 6h7M22 13h6M9 14v4M17 10v4M25 17v4" />
    </BaseIcon>
  ),
  monument: (props) => (
    <BaseIcon {...props}>
      <path d="M5 27h22M8 24h16M10 21h12M12 21V9h8v12M11 9h10M13 6h6M16 3v3" />
    </BaseIcon>
  ),
  fortress: (props) => (
    <BaseIcon {...props}>
      <path d="M4 27V9h5v4h5V9h4v4h5V9h5v18M4 15h24M10 27v-6h12v6M7 19h3M22 19h3" />
    </BaseIcon>
  ),
  mine: (props) => (
    <BaseIcon {...props}>
      <path d="M5 27h22M8 27c0-10 3-16 8-19 5 3 8 9 8 19M12 27v-8h8v8M6 7l20 14M26 7 6 21" />
    </BaseIcon>
  ),
  landmark: (props) => (
    <BaseIcon {...props}>
      <path d="M16 29s9-9 9-17a9 9 0 1 0-18 0c0 8 9 17 9 17Z" />
      <circle cx="16" cy="12" r="3" />
    </BaseIcon>
  ),
};

export function MapFeatureIcon({
  kind,
  ...props
}: IconProps & { kind: MapFeatureKind }) {
  return icons[kind](props);
}
