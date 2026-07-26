# Nation lore

Sistema riutilizzabile per le voci enciclopediche dedicate a nazioni e regioni.
Nessun componente contiene dati specifici della Selodia.

## API pubblica

Importare sempre da `app/components/nation-lore`:

```tsx
import {
  NationLorePage,
  type NationAtlas,
  type EncyclopediaNavigation,
} from "@/app/components/nation-lore";
```

`NationLorePage` riceve:

- `atlas`: titolo, sottotitolo, fatti, testo d’atmosfera e mappa;
- `children`: capitoli MDX;
- `navigation`: indice globale opzionale;
- `theme`: override semantici opzionali della palette.

## Responsabilità CSS

- `app/globals.css`: palette principale condivisa dall’intera applicazione.
- `styles/nation-page-shell.css`: token semantici, viewport, livelli Swiper,
  cornice, scrollbar ed effetti comuni.
- `circle-control.css`: unica implementazione visiva di tutti i circle button,
  comprese transizioni, ring, SVG, hover, active e focus.
- `styles/nation-controls.css`: soltanto posizione e visibilità dei diversi
  tipi di circle button.
- `sidebar/sidebar.css`: meccanica generica di apertura, chiusura, lato e scrim.
- `styles/nation-sidebars.css`: unica skin Nation Lore delle sidebar; sinistra
  e destra cambiano solo tramite variabili di lato.
- `styles/encyclopedia-drawer.css`: contenuto specifico dell’indice.
- `styles/nation-atlas.css`: mappa e contenuto informativo dell’Atlante.
- `styles/nation-lore-slides.css`: tipografia e scorrimento dei capitoli.
- `styles/nation-pagination.css`: navigazione tra sezioni e sottosezioni.
- `styles/nation-mobile-tools.css`: stato base degli strumenti esclusivamente
  mobili.
- `styles/nation-responsive.css`: unico posto in cui sono ammessi breakpoint
  basati su larghezza, altezza o orientamento della finestra.

## Circle button adattivi

`CircleControl` non riceve classi di tema. La palette è ereditata dal contesto
tramite:

```css
--circle-background;
--circle-icon;
--circle-icon-hover;
--circle-ring;
--circle-track;
```

Il telaio verde fornisce automaticamente fondo verde scuro, icona avorio e
hover dorato. Le sidebar avorio e la testata mobile avorio forniscono
automaticamente fondo burgundy, icona avorio e hover dorato.

## Regole di manutenzione

1. Una nazione nuova aggiunge dati e contenuto, non duplica componenti.
2. I pannelli laterali usano sempre `Sidebar`.
3. I controlli circolari usano sempre `CircleControl`.
4. I capitoli MDX usano `NationLoreChapter`.
5. Un modulo definisce il proprio stile comune una sola volta.
6. Le differenze tra tipi di controllo riguardano posizione e stato, non la
   loro implementazione visiva.
7. Le differenze tra sidebar sinistra e destra riguardano lato, direzione,
   ombra e origine del radial gradient.
8. Ogni regola dipendente dalla dimensione della viewport vive in
   `nation-responsive.css`.
9. I colori principali non vengono inseriti come valori esadecimali nei
   moduli: provengono dai token globali e dai relativi alias `--nation-*`.
