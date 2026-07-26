import type { CSSProperties } from "react";

export function CompassControl({
  headingRadians,
  onReset,
}: {
  headingRadians: number;
  onReset: () => void;
}) {
  return (
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
  );
}
