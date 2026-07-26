import type { ReactNode } from "react";
import type { NationAtlas } from "../nation-lore-types";
import { NationAtlasSlide } from "../nation-atlas-slide";

interface NationLoreViewportProps {
  atlas: NationAtlas;
  children: ReactNode;
  navigation: ReactNode;
}

export function NationLoreViewport({
  atlas,
  children,
  navigation,
}: NationLoreViewportProps) {
  return (
    <div className="nation-lore-layout">
      <div className="nation-lore-rail-layer">
        <span className="nation-lore-divider" aria-hidden="true" />
        {navigation}
      </div>
      <div className="swiper nation-lore-swiper">
        <div className="swiper-wrapper">
          <div
            className="swiper-slide nation-atlas-slide"
            data-hash="atlante"
          >
            <NationAtlasSlide atlas={atlas} />
          </div>
          {children}
        </div>
      </div>
      <div
        className="nation-swiper-pagination-engine"
        aria-label="Sezioni della voce"
      />
    </div>
  );
}
