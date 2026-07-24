"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type IconName =
  | "book"
  | "compass"
  | "crown"
  | "hourglass"
  | "spark"
  | "paw"
  | "dice"
  | "search"
  | "arrow"
  | "map"
  | "feather"
  | "menu";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.3 5.7L8 16l2.3-5.7L16 8Z" /></>,
    crown: <><path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z" /><path d="M5 21h14" /></>,
    hourglass: <><path d="M5 2h14M5 22h14M7 2v5l5 5 5-5V2M7 22v-5l5-5 5 5v5" /></>,
    spark: <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3Z" />,
    paw: <><circle cx="7" cy="8" r="2" /><circle cx="17" cy="8" r="2" /><circle cx="12" cy="5" r="2" /><path d="M6.5 16.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5c0 2-1.5 3.5-3.3 2.7a5.5 5.5 0 0 0-4.4 0c-1.8.8-3.3-.7-3.3-2.7Z" /></>,
    dice: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /><circle cx="12" cy="7" r=".8" fill="currentColor" /><circle cx="7.5" cy="14.5" r=".8" fill="currentColor" /><circle cx="16.5" cy="14.5" r=".8" fill="currentColor" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    feather: <><path d="M20 4c-5.5-2-12 1-14 7-1 3-1 6-3 9 3-2 6-2 9-3 6-2 9.5-8.5 8-13Z" /><path d="M5 17 15 7" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const categories = [
  { icon: "compass" as const, title: "Mondo e Geografia", count: "12 articoli", description: "Continenti, isole, mari e terre che danno forma a ogni racconto.", featured: "L’Isola di Selodia" },
  { icon: "crown" as const, title: "Popoli e Nazioni", count: "8 articoli", description: "Regni, culture, fazioni e coloro che ne reggono le sorti.", featured: "La Corona Selodiana" },
  { icon: "hourglass" as const, title: "Storia ed Ere", count: "16 articoli", description: "Una cronaca di imperi, rivoluzioni, scoperte ed epoche dimenticate.", featured: "La Frattura" },
  { icon: "spark" as const, title: "Fede e Cosmologia", count: "9 articoli", description: "Divinità, piani, tradizioni sacre e natura del cosmo.", featured: "L’Accordo Celeste" },
  { icon: "paw" as const, title: "Bestiario", count: "24 voci", description: "Creature meravigliose e terribili, catalogate per chi osa incontrarle.", featured: "Viverna dalla Corona Cinerea" },
  { icon: "dice" as const, title: "Regole e Gioco", count: "11 capitoli", description: "Regole d20, opzioni per i personaggi, equipaggiamento e guida al tavolo.", featured: "Regole Fondamentali" },
];

const updates = [
  { date: "21 LUG", type: "Geografia", title: "Le Vie del Sale della Selodia Occidentale", detail: "Rotte commerciali · 6 min di lettura" },
  { date: "18 LUG", type: "Bestiario", title: "Viverna dalla Corona Cinerea", detail: "Drago enorme · GS 12" },
  { date: "12 LUG", type: "Storia", title: "La Guerra dei Tre Vessilli", detail: "Quarta Era · 9 min di lettura" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const filtered = useMemo(
    () => categories.filter((item) => `${item.title} ${item.description} ${item.featured}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="La Grande Enciclopedia, pagina iniziale">
          <span className="brand-mark encyclopedia-mark"><Icon name="book" size={21} /></span>
          <span><b>La Grande Enciclopedia</b><small>Un compendio sul mondo conosciuto e non</small></span>
        </a>
        <div className="top-actions">
          <label className="search-box">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nel codice..." aria-label="Cerca nel codice" />
            <kbd>⌘ K</kbd>
          </label>
          <a className="reading-link" href="#updates">Da leggere <span>3</span></a>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Apri o chiudi la navigazione" aria-expanded={menuOpen}><Icon name="menu" /></button>
        </div>
      </header>

      <aside className={menuOpen ? "sidebar is-open" : "sidebar"}>
        <nav aria-label="Sezioni del codice">
          <p className="nav-label">L’Enciclopedia</p>
          <a className="active" href="#top"><Icon name="book" />Pagina iniziale</a>
          <a href="#atlas"><Icon name="map" />Atlante</a>
          <a href="#library"><Icon name="feather" />Tutti gli articoli</a>
          <p className="nav-label section-label">Esplora per argomento</p>
          {categories.map((category) => <a href={`#${category.title.toLowerCase().split(" ")[0]}`} key={category.title}><Icon name={category.icon} />{category.title.split(" & ")[0]}</a>)}
        </nav>
        <div className="sidebar-note">
          <span className="d20"><b>20</b></span>
          <div><strong>Usare l’Enciclopedia</strong><p>Le regole usano il sistema d20. L’ambientazione è indipendente dal sistema, salvo diversa indicazione.</p></div>
        </div>
        <p className="edition">Edizione del lettore · v0.1</p>
      </aside>

      <main id="top" className="content">
        <section className="hero" id="atlas">
          <div className="hero-copy">
            <p className="eyebrow">Benvenuto, viandante</p>
            <h1>Un mondo immenso ti attende<br />tra queste pagine.</h1>
            <p className="hero-intro">La Grande Enciclopedia raccoglie i luoghi, i popoli, le storie e le meraviglie di Deia insieme alle regole per portarli al tavolo: un’opera viva per studiosi, narratori e avventurieri.</p>
            <div className="author-line">
              <span className="author-monogram">V</span>
              <p>
                <small>Archivio Enciclopedico dell’Arcontato</small>
                <strong>Prof. Vittorio Neri</strong>
                <em>Seconda Edizione Riveduta — 1502</em>
              </p>
            </div>
            <div className="hero-actions">
              <a className="primary-button" href="#library">Inizia a esplorare <Icon name="arrow" /></a>
              <a className="text-link" href="#rules"><Icon name="dice" /> Leggi le regole</a>
            </div>
            <div className="edition-line"><span /> Volume I · il Mondo <span /></div>
          </div>
          <a className="map-card" href="/world/selodia" aria-label="Leggi l’articolo sulla Selodia">
            <Image src="/selodia-official-map.jpg" alt="Carta ufficiale dell’Arcontato di Selodia" fill priority sizes="(max-width: 900px) 100vw, 55vw" />
            <div className="map-wash" />
            <div className="map-label"><small>Isola · Arcontato</small><strong>Selodia</strong><span>Leggi l’articolo <Icon name="arrow" size={15} /></span></div>
            <div className="cover-flag">
              <Image src="/selodian-flag.png" alt="Vessillo ufficiale della Selodia" width={178} height={107} />
              <span>Vessillo dell’Arcontato</span>
            </div>
            <div className="compass-rose">✦<span>N</span></div>
          </a>
        </section>

        <section className="library" id="library">
          <div className="section-heading">
            <div><p className="eyebrow">Apri gli archivi</p><h2>Esplora l’enciclopedia</h2></div>
            <p>Tutto ciò che è noto — e alcune cose<br />che sarebbe meglio non conoscere.</p>
          </div>
          {query && <p className="search-result">{filtered.length} {filtered.length === 1 ? "sezione trovata" : "sezioni trovate"} per “{query}”</p>}
          <div className="category-grid">
            {filtered.map((category) => (
              <article className="category-card" id={category.title.toLowerCase().split(" ")[0]} key={category.title}>
                <div className="card-top"><span className="category-icon"><Icon name={category.icon} size={22} /></span><small>{category.count}</small></div>
                <h3>{category.title}</h3>
                <p>{category.description}</p>
                <a href="#updates"><span>In evidenza</span>{category.featured}<Icon name="arrow" size={15} /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="lower-grid" id="updates">
          <div className="updates-panel">
            <div className="mini-heading"><div><p className="eyebrow">Dallo scriptorium</p><h2>Cronache recenti</h2></div><a href="#library">Vedi tutte <Icon name="arrow" size={14} /></a></div>
            <div className="updates-list">
              {updates.map((item) => (
                <a href="#library" className="update-row" key={item.title}>
                  <time>{item.date.split(" ")[0]}<span>{item.date.split(" ")[1]}</span></time>
                  <div><small>{item.type}</small><h3>{item.title}</h3><p>{item.detail}</p></div>
                  <Icon name="arrow" />
                </a>
              ))}
            </div>
          </div>
          <aside className="quote-panel">
            <Image src="/selodian-flag.png" alt="" fill sizes="360px" />
            <div className="quote-overlay" />
            <span className="quote-mark">“</span>
            <blockquote>Le mappe ci dicono dove conducono le strade. Le storie ci dicono perché le percorriamo.</blockquote>
            <cite>— Arven Tal, Cartografo Reale</cite>
            <div className="ornament">✦</div>
          </aside>
        </section>

        <section className="rules-banner" id="rules">
          <div className="rules-die"><span>20</span></div>
          <div><p className="eyebrow">Pensato per il tavolo</p><h2>L’avventura usa il sistema d20.</h2><p>Fondamenta familiari, opzioni legate all’ambientazione e regole chiare per mantenere la storia in movimento.</p></div>
          <a className="outline-button" href="#library">Apri la guida del giocatore <Icon name="arrow" /></a>
        </section>

        <footer>
          <span>LA GRANDE ENCICLOPEDIA</span>
          <p>Creato per le storie ancora da raccontare.</p>
          <span>MMXXVI</span>
        </footer>
      </main>
    </div>
  );
}
