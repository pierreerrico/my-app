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
- `theme`: colori opzionali. In assenza di configurazione usa il tema verde e
  oro predefinito.

## Struttura

- `components/`: elementi di presentazione e layout;
- `content/`: trasformazione dei contenuti MDX in capitoli e sottocapitoli;
- `config/`: configurazioni predefinite sostituibili;
- `hooks/`: stato responsive e ciclo di vita di Swiper;
- `navigation/`: funzioni pure che leggono e comandano gli Swiper;
- `styles/`: CSS diviso per responsabilità;
- `nation-lore-types.ts`: contratto dati pubblico;
- `index.ts`: unico punto di esportazione.

## Regole di manutenzione

1. Una nazione nuova deve aggiungere dati e contenuto, non duplicare componenti.
2. I pannelli laterali usano sempre `LateralPanel`.
3. I controlli circolari usano sempre `CircleControl`.
4. I capitoli MDX usano `NationLoreChapter` (esposto in MDX come
   `ArticleChapter` per compatibilità).
5. Ogni foglio di stile dichiara prima le regole comuni del proprio modulo e
   poi, nello stesso file, le sue varianti responsive. `nation-responsive.css`
   coordina soltanto la geometria che coinvolge piÃ¹ moduli.
6. Le viste supportate sono mobile portrait/landscape, tablet
   portrait/landscape e desktop portrait/landscape. I tablet combinano la
   scheda di lettura desktop con controlli e sidebar a comparsa.
7. I colori della nazione passano da `theme`, non da nuove regole hardcoded.
