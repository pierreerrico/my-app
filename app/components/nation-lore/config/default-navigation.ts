import type { EncyclopediaNavigation } from "../nation-lore-types";

export const defaultEncyclopediaNavigation: EncyclopediaNavigation = {
  title: "La Grande Enciclopedia",
  subtitle: "Indice generale",
  groups: [
    {
      label: "L’Enciclopedia",
      items: [
        { label: "Pagina iniziale", href: "/#top", icon: "book" },
        { label: "Atlante", href: "/#atlas", icon: "map" },
        { label: "Tutti gli articoli", href: "/#library", icon: "feather" },
      ],
    },
    {
      label: "Esplora per argomento",
      items: [
        { label: "Mondo e Geografia", href: "/#mondo", icon: "compass" },
        { label: "Popoli e Nazioni", href: "/#popoli", icon: "crown" },
        { label: "Storia ed Ere", href: "/#storia", icon: "hourglass" },
        { label: "Fede e Cosmologia", href: "/#fede", icon: "spark" },
        { label: "Bestiario", href: "/#bestiario", icon: "paw" },
        { label: "Regole e Gioco", href: "/#regole", icon: "dice" },
      ],
    },
  ],
  footer: {
    badge: "20",
    title: "Sistema d20",
    description: "Regole e ambientazione in un solo archivio.",
  },
};
