"use client";

import { useState, type ReactNode } from "react";
import { CircleControl } from "../circle-control";

export function MobileQuoteDialog({ quotes }: { quotes: ReactNode[] }) {
  const [openQuote, setOpenQuote] = useState<number | null>(null);
  if (quotes.length === 0) return null;

  return (
    <div className="nation-mobile-quotes">
      <div
        className="nation-mobile-quote-triggers"
        aria-label="Citazioni della sezione"
      >
        {quotes.map((_, index) => (
          <div
            className="nation-mobile-quote-action"
            key={`quote-trigger-${index}`}
          >
            <CircleControl
              type="button"
              icon="quote"
              aria-label={`Apri la citazione ${index + 1}`}
              onClick={() => setOpenQuote(index)}
            />
            <span>
              {index === 0 ? "Leggi un estratto" : `Estratto ${index + 1}`}
            </span>
          </div>
        ))}
      </div>

      {openQuote !== null && (
        <div
          className="nation-mobile-quote-overlay"
          role="presentation"
          onClick={() => setOpenQuote(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Citazione"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Chiudi la citazione"
              onClick={() => setOpenQuote(null)}
            >
              ×
            </button>
            <blockquote>{quotes[openQuote]}</blockquote>
          </div>
        </div>
      )}
    </div>
  );
}
