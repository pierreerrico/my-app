"use client";

import { useRouter } from "next/navigation";

export default function ArticleEntryCards() {
  const router = useRouter();

  function openPreface() {
    document
      .querySelector(".article-body > p:first-child")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="article-entry-cards" aria-label="Strumenti dell’articolo">
      <button className="entry-card entry-preface" type="button" onClick={openPreface}>
        <span className="entry-number">I</span>
        <span>
          <small>Inizia la lettura</small>
          <strong>L’Arcontato di Selodia</strong>
          <p>Un primo sguardo all’isola, alla sua capitale e all’ordine che ne governa ogni aspetto.</p>
        </span>
        <b aria-hidden="true">↓</b>
      </button>
      <button
        className="entry-card entry-map"
        type="button"
        onClick={() => router.push("/world/selodia/map")}
      >
        <span className="entry-number">✦</span>
        <span>
          <small>Atlante dell’Arcontato</small>
          <strong>Visualizza mappa</strong>
          <p>Esplora territori, città, rilievi e luoghi d’interesse sulla carta interattiva.</p>
        </span>
        <b aria-hidden="true">↗</b>
      </button>
    </section>
  );
}
