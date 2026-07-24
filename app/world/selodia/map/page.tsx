import Link from "next/link";
import { NationMap } from "../../../components/map";
import { deriveMapGeometry, selodiaMap } from "../../../data/maps";

export const metadata = {
  title: "Atlante di Selodia | La Grande Enciclopedia",
  description:
    "Carta geografica tridimensionale interattiva dell’Arcontato di Selodia.",
};

function formatMapLongitude(value: number) {
  const direction = value < 0 ? "O" : value > 0 ? "E" : "";

  return `${Math.abs(value).toFixed(2)}°${direction}`;
}

function formatMapLatitude(value: number) {
  const direction = value < 0 ? "S" : value > 0 ? "N" : "";

  return `${Math.abs(value).toFixed(2)}°${direction}`;
}

export default function SelodiaMapPage() {
  const geometry = deriveMapGeometry(selodiaMap);
  const { bounds } = geometry;

  return (
    <main className="map-page">
      <header className="map-page-header">
        <div>
          <p className="eyebrow">Atlante della Grande Enciclopedia</p>

          <h1>{selodiaMap.title}</h1>

          {selodiaMap.subtitle && <p>{selodiaMap.subtitle}</p>}
        </div>

        <Link href="/world/selodia">← Torna all’articolo</Link>
      </header>

      <section className="map-stage">
        <NationMap config={selodiaMap} />
      </section>

      <footer className="map-page-footer">
        <span>
          {formatMapLatitude(bounds.south)}–
          {formatMapLatitude(bounds.north)}
        </span>

        <span>
          {selodiaMap.geography.mapWidthKm.toLocaleString("it-IT")} ×{" "}
          {selodiaMap.geography.mapHeightKm.toLocaleString("it-IT")} km ·
          Rilievo 2,5D
        </span>

        <span>
          {formatMapLongitude(bounds.west)}–
          {formatMapLongitude(bounds.east)}
        </span>
      </footer>
    </main>
  );
}