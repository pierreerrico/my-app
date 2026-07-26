"use client";

import { useEffect, useRef, useState } from "react";

interface NationMobileNavigationProps {
  current: number;
  labels: string[];
  onNavigate(index: number): void;
}

export function NationMobileNavigation({
  current,
  labels,
  onNavigate,
}: NationMobileNavigationProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(current);

  useEffect(() => {
    const timeline = timelineRef.current;
    const selected = timeline?.querySelector<HTMLElement>(
      `[data-index="${current}"]`,
    );
    if (!timeline || !selected) return;

    setPreview(current);
    timeline.scrollTo({
      left:
        selected.offsetLeft -
        timeline.clientWidth / 2 +
        selected.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [current, labels.length]);

  const handleScroll = () => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const center = timeline.scrollLeft + timeline.clientWidth / 2;
    const buttons = Array.from(
      timeline.querySelectorAll<HTMLButtonElement>("[data-index]"),
    );
    const nearest = buttons.reduce<HTMLButtonElement | null>((best, button) => {
      if (!best) return button;
      const distance = Math.abs(
        button.offsetLeft + button.offsetWidth / 2 - center,
      );
      const bestDistance = Math.abs(
        best.offsetLeft + best.offsetWidth / 2 - center,
      );
      return distance < bestDistance ? button : best;
    }, null);
    if (!nearest) return;

    const index = Number(nearest.dataset.index);
    setPreview(index);
  };

  return (
    <>
      <label className="nation-mobile-progress">
        <span>Avanzamento nella voce</span>
        <input
          type="range"
          min={0}
          max={Math.max(labels.length - 1, 0)}
          step={1}
          value={current}
          onChange={(event) => onNavigate(Number(event.target.value))}
        />
      </label>

      <nav
        ref={timelineRef}
        className="nation-mobile-section-timeline"
        aria-label="Avanzamento nelle sezioni"
        onScroll={handleScroll}
      >
        <div className="nation-mobile-section-track">
          <span className="nation-mobile-timeline-spacer" aria-hidden="true" />
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
              aria-label={`Vai a ${label}`}
              aria-current={index === current ? "step" : undefined}
              onClick={() => onNavigate(index)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
          <span className="nation-mobile-timeline-spacer" aria-hidden="true" />
        </div>
        <output
          className={preview === current ? "is-selected" : ""}
          aria-live="polite"
        >
          {labels[preview] ?? "Atlante"}
        </output>
      </nav>
    </>
  );
}
