"use client";

import { useEffect, useState } from "react";

const INFO_PINNED_QUERY = "(min-width: 1281px)";
const MENU_PINNED_QUERY = "(min-width: 1600px)";

export function useDesktopLayout() {
  const [layout, setLayout] = useState({
    pinInfo: false,
    pinMenu: false,
  });

  useEffect(() => {
    const infoQuery = window.matchMedia(INFO_PINNED_QUERY);
    const menuQuery = window.matchMedia(MENU_PINNED_QUERY);
    const update = () => {
      setLayout({
        pinInfo: infoQuery.matches,
        pinMenu: menuQuery.matches,
      });
    };
    update();
    infoQuery.addEventListener("change", update);
    menuQuery.addEventListener("change", update);
    return () => {
      infoQuery.removeEventListener("change", update);
      menuQuery.removeEventListener("change", update);
    };
  }, []);

  return layout;
}
