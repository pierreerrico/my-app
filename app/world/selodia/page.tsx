import SelodiaArticle from "./content/selodia.mdx";
import SelodiaInteractiveMap from "../../components/map/selodia-map";
import {
  NationLorePage,
  type NationAtlas,
} from "../../components/nation-lore";

export const metadata = {
  title: "Selodia | La Grande Enciclopedia",
  description:
    "L’Arcontato di Selodia: geografia, scienza arcana, società, storia e futuro incerto.",
};

const selodiaAtlas: NationAtlas = {
  title: "Selodia",
  subtitle: "L’isola oltre la nebbia",
  map: <SelodiaInteractiveMap />,
  facts: [
    { kind: "officialName", label: "Nome ufficiale", value: "Il Serenissimo Arcontato di Selodia" },
    { kind: "language", label: "Lingua ufficiale", value: "Selodiano" },
    { kind: "capital", label: "Capitale", value: "Arsecori" },
    { kind: "government", label: "Governo", value: "Monarchia magocratica costituzionale" },
    { kind: "magic", label: "Status della magia", value: "Universale e istituzionalizzata" },
    { kind: "technology", label: "Livello tecnologico", value: "Epoca dell'Informazione" },
    { kind: "area", label: "Superficie", value: "9.374 km²" },
    { kind: "population", label: "Popolazione", value: "3,41 milioni" },
    { kind: "qualityOfLife", label: "Qualità della vita", value: "Altissima" },
  ],
  flavorText: (
    <>
      <p>
        È difficile parlare della Selodia senza indulgere nell’orgoglio. Più
        difficile ancora è descriverla senza ometterne le contraddizioni.
      </p>
      <p>
        Una terra di straordinaria bellezza, plasmata con la stessa disciplina
        con cui ha plasmato il proprio popolo.
      </p>
    </>
  ),
};

export default function SelodiaPage() {
  return (
    <main className="article-page">
      <NationLorePage atlas={selodiaAtlas}>
        <SelodiaArticle />
      </NationLorePage>
    </main>
  );
}
