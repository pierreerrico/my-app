import type { CSSProperties } from "react";

export function CompassControl({
  headingRadians,
  onReset,
  onRotateLeft,
  onRotateRight,
}: {
  headingRadians: number;
  onReset: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
}) {
  return (
    <div className="compass-rotation-controls" aria-label="Controlli orientamento">
      <button
        className="map-round-control map-rotation-control"
        type="button"
        onClick={onRotateLeft}
        aria-label="Ruota la carta a sinistra"
        title="Ruota a sinistra"
      >
        <span aria-hidden="true">↶</span>
      </button>

      <button
        className="compass-control"
        type="button"
        onClick={onReset}
        aria-label="Riallinea la carta verso nord"
        title="Riallinea il nord"
      >
        <span
          className="compass-dial"
          style={
            {
              "--compass-heading": `${-headingRadians}rad`,
            } as CSSProperties
          }
        >
          <b>N</b>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 5L61 39L95 50L61 61L50 95L39 61L5 50L39 39Z" />
            <path d="M50 16L55 45L84 50L55 55L50 84L45 55L16 50L45 45Z" />
            <circle cx="50" cy="50" r="9" />
          </svg>
        </span>
      </button>

      <button
        className="map-round-control map-rotation-control"
        type="button"
        onClick={onRotateRight}
        aria-label="Ruota la carta a destra"
        title="Ruota a destra"
      >
        <span aria-hidden="true">↷</span>
      </button>
    </div>
  );
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="map-zoom-controls" aria-label="Controlli zoom">
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 2}
        aria-label="Aumenta lo zoom"
        title="Aumenta lo zoom"
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 0}
        aria-label="Riduci lo zoom"
        title="Riduci lo zoom"
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  );
}
