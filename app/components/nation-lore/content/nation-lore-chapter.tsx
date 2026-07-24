"use client";

import {
  Children,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type SwiperCore from "swiper";
import { Keyboard, Mousewheel } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { MobileQuoteDialog } from "./nation-quote-dialog";

interface LoreSection {
  title: string;
  content: ReactNode[];
}

export interface NationLoreChapterProps {
  id: string;
  title: string;
  children: ReactNode;
  /** @deprecated Navigation is derived from slide order. */
  next?: string;
  /** @deprecated Navigation is derived from slide order. */
  nextLabel?: string;
}

/**
 * Turns one MDX chapter into a vertical Swiper with one slide per h3 section.
 * Content authors only need headings; navigation is generated automatically.
 */
export function NationLoreChapter({
  id,
  title,
  children,
}: NationLoreChapterProps) {
  const swiperRef = useRef<SwiperCore | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const sections = groupContentByHeading(title, children);

  return (
    <section
      className={`swiper-slide nation-chapter${
        activeSection === sections.length - 1 ? " is-final-subchapter" : ""
      }`}
      id={id}
      data-hash={id}
      aria-label={title}
    >
      <Swiper
        className="nation-subchapter-swiper"
        modules={[Keyboard, Mousewheel]}
        direction="vertical"
        slidesPerView={1}
        speed={700}
        nested
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={(swiper) => {
          setActiveSection(swiper.activeIndex);
          swiper.el.dispatchEvent(
            new CustomEvent("nation-subchapter-change", {
              bubbles: true,
              detail: {
                chapterId: id,
                index: swiper.activeIndex,
                total: swiper.slides.length,
              },
            }),
          );
        }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
      >
        {sections.map((section, index) => (
          <SwiperSlide key={`${id}-${index}`}>
            <article className="nation-subchapter">
              <header>
                <h2>{section.title}</h2>
              </header>
              <MobileQuoteDialog quotes={quotesFromContent(section.content)} />
              <div className="nation-subchapter-content">
                {section.content}
              </div>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>

      <ChapterSectionNavigation
        chapterId={id}
        chapterTitle={title}
        sections={sections}
        activeSection={activeSection}
        onSelect={(index) => swiperRef.current?.slideTo(index)}
      />
    </section>
  );
}

interface ChapterSectionNavigationProps {
  chapterId: string;
  chapterTitle: string;
  sections: LoreSection[];
  activeSection: number;
  onSelect(index: number): void;
}

function ChapterSectionNavigation({
  chapterId,
  chapterTitle,
  sections,
  activeSection,
  onSelect,
}: ChapterSectionNavigationProps) {
  return (
    <nav
      className="nation-subchapter-pagination-source"
      data-chapter-id={chapterId}
      data-active-subchapter={activeSection}
      aria-label={`Sottocapitoli di ${chapterTitle}`}
    >
      {sections.map((section, index) => {
        const label = index === 0 ? "Introduzione" : section.title;
        return (
          <button
            key={`${chapterId}-navigation-${index}`}
            type="button"
            className={index === activeSection ? "is-active" : ""}
            aria-current={index === activeSection ? "true" : undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(index);
            }}
          >
            <span aria-hidden="true" />
            <b>{label}</b>
          </button>
        );
      })}
    </nav>
  );
}

function groupContentByHeading(
  chapterTitle: string,
  children: ReactNode,
): LoreSection[] {
  const sections: LoreSection[] = [{ title: chapterTitle, content: [] }];

  Children.toArray(children).forEach((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === "h3") {
      sections.push({
        title: textFromNode(child.props.children),
        content: [],
      });
      return;
    }
    sections.at(-1)?.content.push(child);
  });

  return sections;
}

function quotesFromContent(content: ReactNode[]): ReactNode[] {
  return content.flatMap((node) => {
    if (
      isValidElement<{ children?: ReactNode }>(node) &&
      node.type === "blockquote"
    ) {
      return [node.props.children];
    }
    return [];
  });
}

function textFromNode(node: ReactNode): string {
  return Children.toArray(node)
    .map((part) => {
      if (typeof part === "string" || typeof part === "number") {
        return String(part);
      }
      if (isValidElement<{ children?: ReactNode }>(part)) {
        return textFromNode(part.props.children);
      }
      return "";
    })
    .join("")
    .trim();
}
