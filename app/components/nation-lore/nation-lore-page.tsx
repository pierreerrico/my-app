"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  const [infoPinnedClosed, setInfoPinnedClosed] = useState(false);
  const [menuPinnedClosed, setMenuPinnedClosed] = useState(false);
  const desktopLayout = useDesktopLayout();

  const closeTransientMenu = useCallback(() => setMenuOpen(false), []);
  const leaveAtlas = useCallback(() => {
    setInfoOpen(false);
    setInfoPinnedClosed(false);
    setMenuPinnedClosed(false);
    rootRef.current?.dispatchEvent(new CustomEvent("nation-map-reset-static"));
  }, []);
  const {
    activeSlide,
    loreGeometryActive,
    flatPosition,
    navigateFlat,
    navigateLore,
    showNext,
    openLore,
  } = useNationLoreSwiper({
    rootRef,
    onSlideChange: closeTransientMenu,
    onAtlasLeave: leaveAtlas,
  });

  const atlasActive = activeSlide === 0;

  const menuPinned = desktopLayout.pinMenu && !atlasActive;
  const infoPinned = desktopLayout.pinInfo && !atlasActive;

  /*
   * Il pinning decide l’apertura predefinita su desktop, non rende il pannello
   * obbligatorio. Lo stesso CircleControl apre e chiude la sidebar e resta
   * montato sopra di essa in entrambi gli stati.
   */
  const menuVisible = menuPinned ? !menuPinnedClosed : menuOpen;
  const infoVisible = infoPinned ? !infoPinnedClosed : infoOpen;

  const toggleMenu = useCallback(() => {
    if (menuPinned) {
      setMenuPinnedClosed((closed) => !closed);
      return;
    }
    setMenuOpen((open) => !open);
  }, [menuPinned]);

  const closeMenu = useCallback(() => {
    if (menuPinned) {
      setMenuPinnedClosed(true);
      return;
    }
    setMenuOpen(false);
  }, [menuPinned]);

  const setInfoVisible = useCallback((open: boolean) => {
    if (infoPinned) {
      setInfoPinnedClosed(!open);
      return;
    }
    setInfoOpen(open);
  }, [infoPinned]);
  const rootClasses = [
    "nation-lore-page",
    atlasActive && "is-atlas-active",
    menuVisible && "is-menu-open",
    menuPinned && "is-menu-pinned",
    infoVisible && "is-info-open",
    infoPinned && "is-info-pinned",
    loreGeometryActive && "is-lore-geometry-active",
  ]
    .filter(Boolean)
    .join(" ");
  const themeVariables = {
    "--nation-green": theme?.primary,
    "--nation-green-deep": theme?.primaryDeep,
    "--nation-green-soft": theme?.primarySoft,
    "--nation-burgundy": theme?.burgundy,
    "--nation-gold": theme?.accent,
    "--nation-gold-strong": theme?.accentStrong,
    "--nation-gold-bright": theme?.accentBright,
    "--nation-ivory": theme?.text,
    "--nation-muted": theme?.mutedText,
    "--nation-paper": theme?.panel,
    "--nation-paper-light": theme?.panelLight,
    "--nation-paper-warm": theme?.panelWarm,
    "--nation-ink": theme?.panelInk,
    "--nation-panel-muted": theme?.panelMuted,
    "--nation-reading-text": theme?.readingText,
  } as CSSProperties;

  return (
    <section ref={rootRef} className={rootClasses} style={themeVariables}>
      <div
        className="nation-page-vignette"
        aria-hidden="true"
      />
      <div
        className="nation-mobile-browser-blend"
        aria-hidden="true"
      />
      <div
        className="nation-mobile-reading-frame"
        aria-hidden="true"
      />
      <NationPageControls
        menuOpen={menuVisible}
        showAtlasLore={atlasActive}
        showPrevious={!atlasActive}
        showNext={!atlasActive && showNext}
        onMenuToggle={toggleMenu}
        onOpenLore={openLore}
        onPrevious={() => navigateLore("previous")}
        onNext={() => navigateLore("next")}
      />

      <EncyclopediaDrawer
        navigation={navigation}
        open={menuVisible}
        onClose={closeMenu}
      />
      <NationAtlasInfo
        atlas={atlas}
        open={infoVisible}
        onOpenChange={setInfoVisible}
      />

      <NationMobileNavigation
        current={flatPosition.index}
        labels={flatPosition.labels}
        onNavigate={navigateFlat}
      />
      <NationLoreViewport
        atlas={atlas}
        navigation={
          <NationSectionNavigation
            current={flatPosition.index}
            labels={flatPosition.labels}
            depths={flatPosition.depths}
            onNavigate={navigateFlat}
          />
        }
      >
        {children}
      </NationLoreViewport>
    </section>
  );
}
