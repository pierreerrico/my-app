import Link from "next/link";
import SelodiaInteractiveMap from "../../../components/map/selodia-map";
import { selodiaMap } from "../../../data/maps";

export const metadata = {
  title: "Atlante di Selodia | La Grande Enciclopedia",
  description: "Carta geografica tridimensionale interattiva dell’Arcontato di Selodia.",
};

export default function SelodiaMapPage() {
  const { coordinates } = selodiaMap;

  return (
    <main className="map-page">
      <header className="map-page-header">
        <div>
          <p className="eyebrow">Atlante della Grande Enciclopedia</p>
          <h1>{selodiaMap.name}</h1>
          <p>{selodiaMap.subtitle}</p>
        </div>
        <Link href="/world/selodia">← Torna all’articolo</Link>
      </header>
      <section className="map-stage">
        <SelodiaInteractiveMap />
      </section>
      <footer className="map-page-footer">
        <span>
          Latitudine {coordinates.south.toFixed(2)}°–{coordinates.north.toFixed(2)}° N
        </span>
        <span>Tavola sperimentale · Rilievo 2,5D</span>
        <span>
          Longitudine {Math.abs(coordinates.west).toFixed(2)}° O–
          {coordinates.east.toFixed(2)}° E
        </span>
      </footer>
    </main>
  );
}
