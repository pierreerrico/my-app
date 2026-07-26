"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type UIEvent,
} from "react";
import "./scroll-area.css";

export interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  viewportProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "onScroll">;
  viewportRef?: Ref<HTMLDivElement>;
  minThumbSize?: number;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

/**
 * Scroll container with a hidden native scrollbar and a shared decorative
 * scrollbar. Visual themes are selected by adding a scrollbar-* class to the
 * root, for example scrollbar-green-gold or scrollbar-burgundy-gold.
 */
export function ScrollArea({
  children,
  className = "",
  viewportClassName = "",
  viewportProps,
  viewportRef,
  minThumbSize = 46,
  onScroll,
}: ScrollAreaProps) {
  const internalViewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalViewportRef.current = node;

      if (typeof viewportRef === "function") {
        viewportRef(node);
      } else if (viewportRef) {
        viewportRef.current = node;
      }
    },
    [viewportRef],
  );

  const syncScrollbar = useCallback(() => {
    const viewport = internalViewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const viewportHeight = viewport.clientHeight;
    const scrollable = viewport.scrollHeight - viewportHeight;
    const trackHeight = track.clientHeight;

    if (scrollable <= 1 || trackHeight <= 0) {
      setThumb({ top: 0, height: trackHeight, visible: false });
      return;
    }

    const height = Math.min(
      trackHeight,
      Math.max(minThumbSize, (trackHeight * viewportHeight) / viewport.scrollHeight),
    );
    const top = (viewport.scrollTop / scrollable) * (trackHeight - height);

    setThumb({ top, height, visible: true });
  }, [minThumbSize]);

  useEffect(() => {
    const viewport = internalViewportRef.current;
    if (!viewport) return;

    let frame = requestAnimationFrame(syncScrollbar);
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncScrollbar);
    });

    const observeChildren = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(viewport);
      Array.from(viewport.children).forEach((child) => resizeObserver.observe(child));
    };

    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncScrollbar);
    });

    observeChildren();
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [syncScrollbar]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScrollbar();
    onScroll?.(event);
  };

  const rootClasses = ["scroll-area", className].filter(Boolean).join(" ");
  const viewportClasses = ["scroll-area__viewport", viewportClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses}>
      <div
        {...viewportProps}
        ref={setViewportRef}
        className={viewportClasses}
        onScroll={handleScroll}
      >
        {children}
      </div>
      <span
        ref={trackRef}
        className={`scroll-area__scrollbar${thumb.visible ? " is-visible" : ""}`}
        aria-hidden="true"
      >
        <i
          className="scroll-area__thumb"
          style={{
            height: thumb.height,
            transform: `translateY(${thumb.top}px)`,
          }}
        />
      </span>
    </div>
  );
}
