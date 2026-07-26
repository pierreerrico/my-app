"use client";

import { useEffect, type RefObject } from "react";

const MOBILE_DOCUMENT_SCROLL_QUERY =
  "(max-width: 767px) and (pointer: coarse)";
const DOCUMENT_SCROLL_RANGE = "--nation-document-scroll-range";
const ACTIVE_CONTENT_SELECTOR = [
  ".nation-chapter.swiper-slide-active",
  ".nation-subchapter-swiper",
  ".swiper-slide-active",
  ".nation-subchapter-content",
].join(" ");

/**
 * On touch phones Safari only retracts its browser chrome when the root
 * document scrolls. The reading UI, however, needs to remain viewport-sized
 * for the two nested Swipers.
 *
 * The document therefore owns the mobile vertical scroll while this hook
 * mirrors its position into the active subchapter. The sticky article shell
 * stays in place and Safari is free to move its toolbar over the page.
 */
export function useMobileDocumentScroll(
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = window.matchMedia(MOBILE_DOCUMENT_SCROLL_QUERY);
    let activeContent: HTMLElement | null = null;
    let activeContentResizeObserver: ResizeObserver | null = null;
    let scheduledFrame: number | null = null;

    const contentScrollRange = (content: HTMLElement) =>
      Math.max(0, content.scrollHeight - content.clientHeight);

    const documentScrollLimit = () =>
      Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );

    /*
     * The part of the document range not used by the article is the native
     * Safari toolbar travel. Content starts moving only after that range.
     */
    const browserChromeRange = (content: HTMLElement) =>
      Math.max(
        0,
        documentScrollLimit() - contentScrollRange(content),
      );

    const updateCustomScrollbar = (content: HTMLElement) => {
      content.dispatchEvent(new Event("scroll"));
    };

    const syncContentFromDocument = () => {
      if (!media.matches || !activeContent) return;

      const range = contentScrollRange(activeContent);
      const nextScrollTop = Math.min(
        range,
        Math.max(0, window.scrollY - browserChromeRange(activeContent)),
      );

      if (Math.abs(activeContent.scrollTop - nextScrollTop) < 0.5) return;
      activeContent.scrollTop = nextScrollTop;
      updateCustomScrollbar(activeContent);
    };

    const setDocumentRange = (content: HTMLElement | null) => {
      const range = content ? contentScrollRange(content) : 0;
      document.body.style.setProperty(DOCUMENT_SCROLL_RANGE, `${range}px`);
    };

    const bindActiveContent = () => {
      scheduledFrame = null;

      if (!media.matches || root.classList.contains("is-atlas-active")) {
        activeContent = null;
        activeContentResizeObserver?.disconnect();
        activeContentResizeObserver = null;
        setDocumentRange(null);
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      const nextContent =
        root.querySelector<HTMLElement>(ACTIVE_CONTENT_SELECTOR);
      if (!nextContent) {
        activeContent = null;
        activeContentResizeObserver?.disconnect();
        activeContentResizeObserver = null;
        setDocumentRange(null);
        return;
      }

      const contentChanged = nextContent !== activeContent;
      activeContent = nextContent;
      const content = nextContent;
      setDocumentRange(content);

      if (contentChanged) {
        activeContentResizeObserver?.disconnect();
        activeContentResizeObserver = new ResizeObserver(() => {
          if (!activeContent) return;
          const preservedScrollTop = activeContent.scrollTop;
          setDocumentRange(activeContent);
          window.requestAnimationFrame(() => {
            if (!activeContent) return;
            window.scrollTo({
              top: browserChromeRange(activeContent) + preservedScrollTop,
              behavior: "auto",
            });
            syncContentFromDocument();
          });
        });
        activeContentResizeObserver.observe(content);
        Array.from(content.children).forEach((child) =>
          activeContentResizeObserver?.observe(child),
        );
      }

      const preservedScrollTop = content.scrollTop;
      window.requestAnimationFrame(() => {
        if (!activeContent) return;
        window.scrollTo({
          top: browserChromeRange(activeContent) + preservedScrollTop,
          behavior: "auto",
        });
        syncContentFromDocument();
      });
    };

    const scheduleActiveContentBinding = () => {
      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }
      scheduledFrame = window.requestAnimationFrame(bindActiveContent);
    };

    const classObserver = new MutationObserver((mutations) => {
      const activeSlideChanged = mutations.some(({ target }) => {
        if (!(target instanceof HTMLElement)) return false;
        return (
          target === root ||
          target.classList.contains("swiper-slide") ||
          target.classList.contains("nation-lore-page")
        );
      });
      if (activeSlideChanged) scheduleActiveContentBinding();
    });

    classObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });

    const handleViewportChange = () => {
      if (!media.matches) {
        activeContent = null;
        activeContentResizeObserver?.disconnect();
        activeContentResizeObserver = null;
        document.body.style.removeProperty(DOCUMENT_SCROLL_RANGE);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      scheduleActiveContentBinding();
    };

    window.addEventListener("scroll", syncContentFromDocument, {
      passive: true,
    });
    window.addEventListener("resize", scheduleActiveContentBinding);
    media.addEventListener("change", handleViewportChange);
    scheduleActiveContentBinding();

    return () => {
      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }
      classObserver.disconnect();
      activeContentResizeObserver?.disconnect();
      window.removeEventListener("scroll", syncContentFromDocument);
      window.removeEventListener("resize", scheduleActiveContentBinding);
      media.removeEventListener("change", handleViewportChange);
      document.body.style.removeProperty(DOCUMENT_SCROLL_RANGE);
      window.scrollTo({ top: 0, behavior: "auto" });
    };
  }, [rootRef]);
}
