import type { NationFactKind } from "./nation-lore-types";

const paths: Record<NationFactKind, React.ReactNode> = {
  officialName: <><path d="M7 3h10l2 3-2 3H7L5 6Z" /><path d="M8 12h8M8 16h8M10 20h4" /></>,
  language: <><path d="M4 5h16v11H9l-5 4Z" /><path d="M8 9h8M8 12h5" /></>,
  capital: <><path d="m12 3 9 5H3Z" /><path d="M5 9v9M9 9v9M15 9v9M19 9v9M3 21h18" /></>,
  government: <><path d="M4 8h16l-2 12H6Z" /><path d="m6 8 2-4 4 4 4-4 2 4" /></>,
  magic: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7Z" /><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7Z" /></>,
  technology: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  area: <><path d="M4 5h16v14H4Z" /><path d="m4 10 5-3 6 4 5-2M9 7v12M15 11v8" /></>,
  population: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c.5-5 3-7 6-7s5.5 2 6 7M14 14c3 0 5 2 5 6" /></>,
  qualityOfLife: <><path d="M12 21S4 16.5 4 10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /></>,
};

export function NationFactIcon({ kind }: { kind: NationFactKind }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {paths[kind]}
      </g>
    </svg>
  );
}
