import Link from "next/link";
import type { ReactNode } from "react";
export {
  NationLoreChapter as ArticleChapter,
  type NationLoreChapterProps as ArticleChapterProps,
} from "./nation-lore/content/nation-lore-chapter";

export function CardCollection({
  children,
  direction = "horizontal",
  title,
}: {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  title?: string;
}) {
  return (
    <section className={`card-collection is-${direction}`}>
      {title && <h3>{title}</h3>}
      <div className="card-collection-track">{children}</div>
    </section>
  );
}

export function LoreCard({
  name,
  description,
  href = "#",
  eyebrow,
}: {
  name: string;
  description: string;
  href?: string;
  eyebrow?: string;
}) {
  return (
    <Link className="lore-card" href={href}>
      {eyebrow && <span>{eyebrow}</span>}
      <strong>{name}</strong>
      <p>{description}</p>
      <small>Apri la voce →</small>
    </Link>
  );
}

export function ArchiveLink({
  name,
  description,
  href,
  entries,
}: {
  name: string;
  description: string;
  href: string;
  entries?: string;
}) {
  return (
    <a className="archive-link" href={href} target="_blank" rel="noreferrer">
      <span className="archive-seal">A</span>
      <span>
        <small>Archivio collegato {entries && `· ${entries}`}</small>
        <strong>{name}</strong>
        <p>{description}</p>
      </span>
      <b aria-hidden="true">↗</b>
    </a>
  );
}
