import {
  NationMap,
} from "../../components/map";
import type { Viewport } from "next";

import {
  NationLorePage,
  type NationAtlas,
} from "../../components/nation-lore";

import {
  deriveMapGeometry,
  selodiaMap,
} from "../../data/maps";

import SelodiaArticle from "./content/selodia.mdx";

export const metadata = {
  title:
    "Selodia | La Grande Enciclopedia",

  description:
    "L’Arcontato di Selodia: geografia, scienza arcana, società, storia e futuro incerto.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2eadb",
};

const selodiaGeometry =
  deriveMapGeometry(selodiaMap);

function formatArea(
  areaKm2: number | undefined,
): string {
  if (
    areaKm2 === undefined ||
    !Number.isFinite(areaKm2) ||
    areaKm2 <= 0
  ) {
    return "Analisi della carta non ancora eseguita";
  }

  return `${new Intl.NumberFormat(
    "it-IT",
    {
      maximumFractionDigits: 0,
    },
  ).format(areaKm2)} km²`;
}

const selodiaAtlas: NationAtlas = {
  title: "Selodia",
  subtitle: "L’isola oltre la nebbia",

  map: (
    <NationMap
      config={selodiaMap}
    />
  ),

  facts: [
    {
      kind: "officialName",
      label: "Nome ufficiale",
      value:
        "Il Serenissimo Arcontato di Selodia",
    },

    {
      kind: "language",
      label: "Lingua ufficiale",
      value: "Selodiano",
    },

    {
      kind: "capital",
      label: "Capitale",
      value: "Arsecori",
    },

    {
      kind: "government",
      label: "Governo",
      value:
        "Monarchia magocratica costituzionale",
    },

    {
      kind: "magic",
      label: "Status della magia",
      value:
        "Universale e istituzionalizzata",
    },

    {
      kind: "technology",
      label: "Livello tecnologico",
      value:
        "Epoca dell'Informazione",
    },

    {
      kind: "area",
      label: "Superficie",
      value: formatArea(
        selodiaGeometry
          .territoryAreaKm2,
      ),
    },

    {
      kind: "population",
      label: "Popolazione",
      value: "3,41 milioni",
    },

    {
      kind: "qualityOfLife",
      label: "Qualità della vita",
      value: "Altissima",
    },
  ],

  flavorText: (
    <>
      <p>
        È difficile parlare della
        Selodia senza indulgere
        nell’orgoglio. Più difficile
        ancora è descriverla senza
        ometterne le contraddizioni.
      </p>

      <p>
        Una terra di straordinaria
        bellezza, plasmata con la stessa
        disciplina con cui ha plasmato
        il proprio popolo.
      </p>
    </>
  ),
};

export default function SelodiaPage() {
  return (
    <main className="article-page">
      <NationLorePage
        atlas={selodiaAtlas}
      >
        <SelodiaArticle />
      </NationLorePage>
    </main>
  );
}
