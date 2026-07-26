"use client";

import {
  useCallback,
  useEffect,
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
import { useMobileDocumentScroll } from "./hooks/use-mobile-document-scroll";
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
  const desktopLayout = useDesktopLayout();
  useMobileDocumentScroll(rootRef);

  const closeTransientMenu = useCallback(() => setMenuOpen(false), []);
  const leaveAtlas = useCallback(() => {
    setInfoOpen(false);
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

  useEffect(() => {
    const themeColor =
      atlasActive
        ? "#b5a88f"
        : theme?.primary ?? "#102f30";
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    meta?.setAttribute("content", themeColor);
  }, [atlasActive, theme?.primary]);

  const menuPinned = desktopLayout.pinMenu && !atlasActive;
  const infoPinned = desktopLayout.pinInfo && !atlasActive;
  const menuVisible = menuPinned || menuOpen;
  const infoVisible = infoPinned || infoOpen;
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
    "--nation-gold": theme?.accent,
    "--nation-gold-bright": theme?.accentBright,
    "--nation-ivory": theme?.text,
    "--nation-muted": theme?.mutedText,
  } as CSSProperties;

  return (
    <section ref={rootRef} className={rootClasses} style={themeVariables}>
      <div
        className="nation-page-vignette"
        aria-hidden="true"
      />
      <NationPageControls
        menuOpen={menuVisible}
        showAtlasLore={atlasActive}
        showPrevious={!atlasActive}
        showNext={!atlasActive && showNext}
        onMenuToggle={() => setMenuOpen((current) => !current)}
        onOpenLore={openLore}
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
        open={infoVisible}
        onOpenChange={(open) => {
          if (!infoPinned) setInfoOpen(open);
        }}
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
