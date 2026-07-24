"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import "swiper/css";
import "swiper/css/pagination";
import type { NationLorePageProps } from "./nation-lore-types";
import { EncyclopediaDrawer } from "./encyclopedia-drawer";
import { NationAtlasInfo } from "./nation-atlas-slide";
import { NationLoreViewport } from "./components/nation-lore-viewport";
import { NationMobileNavigation } from "./components/nation-mobile-navigation";
import { NationSectionNavigation } from "./components/nation-section-navigation";
import { NationPageControls } from "./components/nation-page-controls";
import { useDesktopLayout } from "./hooks/use-desktop-layout";
import { useNationLoreSwiper } from "./hooks/use-nation-lore-swiper";
import "./nation-lore-page.css";

/**
 * Generic nation article shell.
 *
 * A nation supplies only atlas data, lore slides and (optionally) its global
 * encyclopedia navigation. Swiper state, responsive controls and sidebars are
 * owned here and shared by every nation page.
 */
export default function NationLorePage({
  atlas,
  children,
  navigation,
  theme,
}: NationLorePageProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDesktop = useDesktopLayout();

  const closeTransientMenu = useCallback(() => setMenuOpen(false), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const {
    activeSlide,
    flatPosition,
    navigateFlat,
    navigateLore,
    showNext,
    openLore,
  } = useNationLoreSwiper({
    rootRef,
    onSlideChange: closeTransientMenu,
    onAtlasLeave: closeInfo,
  });

  const atlasActive = activeSlide === 0;
  const menuPinned = isDesktop && !atlasActive;
  const menuVisible = menuPinned || menuOpen;
  const rootClasses = [
    "nation-lore-page",
    atlasActive && "is-atlas-active",
    menuVisible && "is-menu-open",
    menuPinned && "is-menu-pinned",
    infoOpen && "is-info-open",
  ]
    .filter(Boolean)
    .join(" ");
  const themeVariables = {
    "--nation-green": theme?.primary,
    "--nation-green-deep": theme?.primaryDeep,
    "--nation-green-soft": theme?.primarySoft,
    "--nation-gold": theme?.accent,
    "--nation-gold-bright": theme?.accentBright,
    "--nation-ivory": theme?.text,
    "--nation-muted": theme?.mutedText,
  } as CSSProperties;

  return (
    <section ref={rootRef} className={rootClasses} style={themeVariables}>
      <NationPageControls
        menuOpen={menuVisible}
        showPrevious={!atlasActive}
        showNext={!atlasActive && showNext}
        onMenuToggle={() => setMenuOpen((current) => !current)}
        onPrevious={() => navigateLore("previous")}
        onNext={() => navigateLore("next")}
      />

      <EncyclopediaDrawer
        navigation={navigation}
        open={menuVisible}
        onClose={() => {
          if (!menuPinned) setMenuOpen(false);
        }}
      />
      <NationAtlasInfo
        atlas={atlas}
        open={infoOpen}
        onOpenChange={setInfoOpen}
      />

      <NationMobileNavigation
        current={flatPosition.index}
        labels={flatPosition.labels}
        onNavigate={navigateFlat}
      />
      <NationSectionNavigation
        current={flatPosition.index}
        labels={flatPosition.labels}
        depths={flatPosition.depths}
        onNavigate={navigateFlat}
      />

      <NationLoreViewport
        atlas={atlas}
        onOpenLore={openLore}
      >
        {children}
      </NationLoreViewport>
    </section>
  );
}
