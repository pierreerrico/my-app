"use client";

import { NationFactIcon } from "./nation-fact-icon";
import type { NationAtlas } from "./nation-lore-types";
import { CircleControl } from "./circle-control";
import { Sidebar } from "../sidebar/sidebar";

export function NationAtlasSlide({
  atlas,
  onDiscover,
}: {
  atlas: NationAtlas;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDiscover: () => void;
}) {
  return (
    <section className="nation-atlas" aria-label={`Atlante di ${atlas.title}`}>
      <div className="nation-atlas-map">{atlas.map}</div>
      <CircleControl className="nation-atlas-lore" type="button" icon="book" aria-label="Apri la sezione di lore" onClick={onDiscover} />
    </section>
  );
}

export function NationAtlasInfo({
  atlas,
  open,
  onOpenChange,
}: {
  atlas: NationAtlas;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <CircleControl
        className="nation-atlas-toggle"
        type="button"
        icon="info"
        active={open}
        aria-expanded={open}
        aria-label={open ? "Chiudi la scheda nazionale" : "Apri la scheda nazionale"}
        onClick={() => onOpenChange(!open)}
      />

      <Sidebar
        id="nation-atlas-info"
        open={open}
        side="right"
        variant="info"
        label="la scheda nazionale"
        className="nation-atlas-sidebar"
        onClose={() => onOpenChange(false)}
      >
        <div className="nation-atlas-sidebar-content">
          <header>
            <h1>{atlas.title}</h1>
            <p>{atlas.subtitle}</p>
          </header>

          <div className="nation-separator" aria-hidden="true"><span /></div>
          <dl className="nation-facts">
            {atlas.facts.map((fact) => (
              <div key={fact.kind}>
                <dt><NationFactIcon kind={fact.kind} /><span>{fact.label}</span></dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="nation-separator" aria-hidden="true"><span /></div>
          <div className="nation-flavor">{atlas.flavorText}</div>
        </div>
      </Sidebar>
    </>
  );
}
