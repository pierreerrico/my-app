"use client";

import { CircleControl } from "../circle-control";

interface NationPageControlsProps {
  menuOpen: boolean;
  showAtlasLore: boolean;
  showPrevious: boolean;
  showNext: boolean;
  onMenuToggle(): void;
  onOpenLore(): void;
  onPrevious(): void;
  onNext(): void;
}

export function NationPageControls({
  menuOpen,
  showAtlasLore,
  showPrevious,
  showNext,
  onMenuToggle,
  onOpenLore,
  onPrevious,
  onNext,
}: NationPageControlsProps) {
  return (
    <>
      <div className="nation-global-controls">
        <CircleControl
          className="nation-menu-control"
          type="button"
          icon="menu"
          active={menuOpen}
          aria-label={menuOpen ? "Chiudi l’indice" : "Apri l’indice"}
          aria-controls="nation-encyclopedia-menu"
          aria-expanded={menuOpen}
          onClick={onMenuToggle}
        />
      </div>

      <CircleControl
        className={`nation-slide-arrow is-previous${showPrevious ? "" : " is-unavailable"}`}
        type="button"
        icon="up"
        aria-label="Vai alla slide precedente"
        onClick={onPrevious}
      />

      <CircleControl
        className={`nation-atlas-lore${showAtlasLore ? "" : " is-unavailable"}`}
        type="button"
        icon="book"
        aria-label="Apri la sezione di lore"
        onClick={onOpenLore}
      />

      <CircleControl
        className={`nation-slide-arrow is-next${showNext ? "" : " is-unavailable"}`}
        type="button"
        icon="down"
        aria-label="Vai alla slide successiva"
        onClick={onNext}
      />
    </>
  );
}
