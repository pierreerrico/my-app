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
  const loopTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState(current);

  const center = (index: number, behavior: ScrollBehavior = "smooth") => {
    const navigation = navigationRef.current;
    const target = navigation?.querySelector<HTMLElement>(
      `[data-cycle="1"][data-index="${index}"]`,
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

  useEffect(
    () => () => {
      if (loopTimer.current !== null) window.clearTimeout(loopTimer.current);
    },
    [],
  );

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
    if (loopTimer.current !== null) window.clearTimeout(loopTimer.current);
    loopTimer.current = window.setTimeout(() => {
      if (nearest.dataset.cycle === "1") return;
      center(index, "auto");
    }, 160);
  };

  return (
    <nav
      ref={navigationRef}
      className="nation-section-navigation"
      aria-label="Sezioni della voce"
      onScroll={handleScroll}
    >
      <div className="nation-section-navigation-track">
        {[0, 1, 2].flatMap((cycle) =>
          labels.map((label, index) => (
            <button
              key={`${cycle}-${index}`}
              type="button"
              className={[
                index === current ? "is-active" : "",
                index === preview ? "is-preview" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-cycle={cycle}
              data-index={index}
              data-depth={depths[index] ?? 0}
              aria-current={
                cycle === 1 && index === current ? "step" : undefined
              }
              onClick={() => onNavigate(index)}
            >
              <span aria-hidden="true" />
              <b>{label}</b>
            </button>
          )),
        )}
      </div>
    </nav>
  );
}
