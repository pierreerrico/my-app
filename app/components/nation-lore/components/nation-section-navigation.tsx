"use client";

import { useEffect, useRef, useState } from "react";

interface NationSectionNavigationProps {
  current: number;
  labels: string[];
  depths: number[];
  onNavigate(index: number): void;
}

export function NationSectionNavigation({
  current,
  labels,
  depths,
  onNavigate,
}: NationSectionNavigationProps) {
  const navigationRef = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState(current);

  const center = (index: number, behavior: ScrollBehavior = "smooth") => {
    const navigation = navigationRef.current;
    const target = navigation?.querySelector<HTMLElement>(
      `[data-index="${index}"]`,
    );
    if (!navigation || !target) return;
    navigation.scrollTo({
      top:
        target.offsetTop -
        navigation.clientHeight / 2 +
        target.offsetHeight / 2,
      behavior,
    });
  };

  useEffect(() => {
    center(current);
  }, [current, labels.length]);

  const handleScroll = () => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const middle = navigation.scrollTop + navigation.clientHeight / 2;
    const buttons = Array.from(
      navigation.querySelectorAll<HTMLButtonElement>("[data-index]"),
    );
    const nearest = buttons.reduce<HTMLButtonElement | null>((best, button) => {
      if (!best) return button;
      const distance = Math.abs(
        button.offsetTop + button.offsetHeight / 2 - middle,
      );
      const bestDistance = Math.abs(
        best.offsetTop + best.offsetHeight / 2 - middle,
      );
      return distance < bestDistance ? button : best;
    }, null);
    if (!nearest) return;

    const index = Number(nearest.dataset.index);
    setPreview(index);
  };

  return (
    <nav
      ref={navigationRef}
      className="nation-section-navigation"
      aria-label="Sezioni della voce"
      onScroll={handleScroll}
    >
      <div className="nation-section-navigation-track">
        {labels.map((label, index) => (
          <button
            key={index}
            type="button"
            className={[
              index === current ? "is-active" : "",
              index === preview ? "is-preview" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-index={index}
            data-depth={depths[index] ?? 0}
            aria-current={index === current ? "step" : undefined}
            onClick={() => onNavigate(index)}
          >
            <span aria-hidden="true" />
            <b>{label}</b>
          </button>
        ))}
      </div>
    </nav>
  );
}
