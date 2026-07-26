"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type UIEvent,
  type WheelEvent,
  type ReactNode,
} from "react";
import type SwiperCore from "swiper";
import { Keyboard, Mousewheel } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

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
  const touchStartYRef = useRef<number | null>(null);
  const touchBoundaryRef = useRef<{
    top: boolean;
    bottom: boolean;
  }>({
    top: false,
    bottom: false,
  });
  const touchNavigationUsedRef = useRef(false);
  const wheelLockedRef = useRef(false);
  const wheelBoundaryDistanceRef = useRef(0);
  const wheelDirectionRef = useRef<"previous" | "next" | null>(null);
  const wheelResetTimerRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const sections = groupContentByHeading(title, children);

  const requestBoundaryNavigation = (
    target: HTMLElement,
    direction: "previous" | "next",
  ) => {
    target.dispatchEvent(
      new CustomEvent("nation-scroll-boundary", {
        bubbles: true,
        detail: { direction },
      }),
    );
  };

  const handleContentWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const content = event.currentTarget;
    const atTop = content.scrollTop <= 1;
    const atBottom =
      content.scrollTop + content.clientHeight >= content.scrollHeight - 1;
    const direction =
      event.deltaY > 0 && atBottom
        ? "next"
        : event.deltaY < 0 && atTop
          ? "previous"
          : null;

    if (!direction) {
      wheelBoundaryDistanceRef.current = 0;
      wheelDirectionRef.current = null;
      return;
    }
    if (wheelLockedRef.current) return;

    if (wheelDirectionRef.current !== direction) {
      wheelBoundaryDistanceRef.current = 0;
      wheelDirectionRef.current = direction;
    }
    wheelBoundaryDistanceRef.current += Math.abs(event.deltaY);

    if (wheelResetTimerRef.current !== null) {
      window.clearTimeout(wheelResetTimerRef.current);
    }
    wheelResetTimerRef.current = window.setTimeout(() => {
      wheelBoundaryDistanceRef.current = 0;
      wheelDirectionRef.current = null;
    }, 500);

    if (wheelBoundaryDistanceRef.current < 140) return;
    wheelLockedRef.current = true;
    wheelBoundaryDistanceRef.current = 0;
    wheelDirectionRef.current = null;
    requestBoundaryNavigation(content, direction);
    window.setTimeout(() => {
      wheelLockedRef.current = false;
    }, 800);
  };

  const handleContentTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchNavigationUsedRef.current = false;
    const content = event.currentTarget;
    touchBoundaryRef.current = {
      top: content.scrollTop <= 1,
      bottom:
        content.scrollTop + content.clientHeight >=
        content.scrollHeight - 1,
    };
  };

  const handleContentTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (
      startY === null ||
      currentY === undefined ||
      touchNavigationUsedRef.current
    ) {
      return;
    }

    const content = event.currentTarget;
    const delta = startY - currentY;
    /*
     * Cambiamo sezione soltanto se il gesto è iniziato al bordo. Se l'utente
     * raggiunge il fondo durante uno scroll normale, il medesimo gesto resta
     * assegnato al testo e non si trasforma improvvisamente in navigazione.
     */
    const startedAtTop =
      touchBoundaryRef.current.top;
    const startedAtBottom =
      touchBoundaryRef.current.bottom;
    const direction =
      delta > 72 && startedAtBottom
        ? "next"
        : delta < -72 && startedAtTop
          ? "previous"
          : null;

    if (!direction) return;
    touchNavigationUsedRef.current = true;
    requestBoundaryNavigation(content, direction);
  };

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
              <ScrollableSubchapterContent
                onWheel={handleContentWheel}
                onTouchStart={handleContentTouchStart}
                onTouchMove={handleContentTouchMove}
              >
                {section.content}
              </ScrollableSubchapterContent>
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

function ScrollableSubchapterContent({
  children,
  onWheel,
  onTouchStart,
  onTouchMove,
}: {
  children: ReactNode;
  onWheel(event: WheelEvent<HTMLDivElement>): void;
  onTouchStart(event: TouchEvent<HTMLDivElement>): void;
  onTouchMove(event: TouchEvent<HTMLDivElement>): void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const syncScrollbar = (content: HTMLDivElement) => {
    const viewport = content.clientHeight;
    const scrollable = content.scrollHeight - viewport;
    const trackHeight =
      content.parentElement?.querySelector<HTMLElement>(
        ".nation-subchapter-scrollbar",
      )?.clientHeight ?? viewport;
    if (scrollable <= 1) {
      setThumb({ top: 0, height: trackHeight, visible: false });
      return;
    }

    const height = Math.max(
      46,
      (trackHeight * viewport) / content.scrollHeight,
    );
    const top = (content.scrollTop / scrollable) * (trackHeight - height);
    setThumb({ top, height, visible: true });
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    syncScrollbar(content);
    const observer = new ResizeObserver(() => syncScrollbar(content));
    observer.observe(content);
    Array.from(content.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScrollbar(event.currentTarget);
  };

  return (
    <div className="nation-subchapter-scroll-region">
      <div
        ref={contentRef}
        className="nation-subchapter-content swiper-no-swiping swiper-no-mousewheel"
        onScroll={handleScroll}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        {children}
      </div>
      <span
        className={`nation-subchapter-scrollbar${thumb.visible ? " is-visible" : ""}`}
        aria-hidden="true"
      >
        <i style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }} />
      </span>
    </div>
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
