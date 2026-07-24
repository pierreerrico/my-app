"use client";

import Link from "next/link";
import type {
  EncyclopediaNavigation,
  NavigationIconName,
} from "./nation-lore-types";
import { defaultEncyclopediaNavigation } from "./config/default-navigation";
import { Sidebar } from "../sidebar/sidebar";

interface EncyclopediaDrawerProps {
  open: boolean;
  onClose(): void;
  navigation?: EncyclopediaNavigation;
}

export function EncyclopediaDrawer({
  open,
  onClose,
  navigation = defaultEncyclopediaNavigation,
}: EncyclopediaDrawerProps) {
  return (
    <Sidebar
      id="nation-encyclopedia-menu"
      open={open}
      side="left"
      variant="menu"
      label="l’indice dell’enciclopedia"
      className="nation-drawer"
      onClose={onClose}
    >
        <header>
          <span className="nation-drawer-mark"><NavIcon name="book" /></span>
          <div><strong>{navigation.title}</strong><small>{navigation.subtitle}</small></div>
        </header>
        <nav aria-label="Indice dell’enciclopedia">
          {navigation.groups.map((group) => (
            <div className="nation-drawer-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <Link href={item.href} key={item.label}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {navigation.footer && (
          <div className="nation-drawer-note">
            <span>{navigation.footer.badge}</span>
            <p>
              <strong>{navigation.footer.title}</strong>
              {navigation.footer.description}
            </p>
          </div>
        )}
    </Sidebar>
  );
}

export function NavIcon({ name }: { name: NavigationIconName }) {
  const paths = {
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    feather: <><path d="M20 4c-5.5-2-12 1-14 7-1 3-1 6-3 9 3-2 6-2 9-3 6-2 9.5-8.5 8-13Z" /><path d="M5 17 15 7" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.3 5.7L8 16l2.3-5.7L16 8Z" /></>,
    crown: <><path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z" /><path d="M5 21h14" /></>,
    hourglass: <><path d="M5 2h14M5 22h14M7 2v5l5 5 5-5V2M7 22v-5l5-5 5 5v5" /></>,
    spark: <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3Z" />,
    paw: <><circle cx="7" cy="8" r="2" /><circle cx="17" cy="8" r="2" /><circle cx="12" cy="5" r="2" /><path d="M6.5 16.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5c0 2-1.5 3.5-3.3 2.7a5.5 5.5 0 0 0-4.4 0c-1.8.8-3.3-.7-3.3-2.7Z" /></>,
    dice: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
