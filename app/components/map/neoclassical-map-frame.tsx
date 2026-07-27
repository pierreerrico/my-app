"use client";

export default function NeoclassicalMapFrame() {
  return (
    <div className="neoclassical-map-frame" aria-hidden="true">
      <span className="neo-matte" />
      <span className="neo-rule is-outer" />
      <span className="neo-rule is-middle" />
      <span className="neo-rule is-inner" />
    </div>
  );
}

/**
 * Versione leggera della cornice mostrata sopra la copertura di prerender.
 * I percorsi iniziano al centro del lato superiore e vengono disegnati in
 * senso orario, così il caricamento costruisce visivamente la tavola.
 */
export function NeoclassicalLoadingFrame() {
  return (
    <svg
      className="map-prerender-frame"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="map-prerender-frame-path is-outer"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M 500 12 H 988 V 988 H 12 V 12 H 500"
      />
      <path
        className="map-prerender-frame-path is-middle"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M 500 28 H 972 V 972 H 28 V 28 H 500"
      />
      <path
        className="map-prerender-frame-path is-inner"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M 500 44 H 956 V 956 H 44 V 44 H 500"
      />
    </svg>
  );
}
