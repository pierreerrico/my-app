"use client";

import { selodiaMap } from "../../data/maps/selodia/selodia";
import NationMap from "./nation-map";

export default function SelodiaInteractiveMap() {
  return <NationMap config={selodiaMap} />;
}