"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Swiper from "swiper";
import { HashNavigation, Keyboard, Mousewheel, Pagination } from "swiper/modules";
import {
  getNestedSwiper,
  labelChapterPagination,
  mountSubnavigation,
  navigateToFlatPosition,
  readFlatLorePosition,
  type FlatLorePosition,
} from "../navigation/nation-swiper-dom";

const PORTRAIT_MOBILE_QUERY =
  "(max-width: 600px) and (orientation: portrait)";

interface UseNationLoreSwiperOptions {
  rootRef: RefObject<HTMLElement | null>;
  onAtlasLeave(): void;
  onSlideChange(): void;
}

export function useNationLoreSwiper({
  rootRef,
  onAtlasLeave,
  onSlideChange,
}: UseNationLoreSwiperOptions) {
  const swiperRef = useRef<Swiper | null>(null);
  const pendingFlatTargetRef = useRef<number | null>(null);
  const pendingFlatTimerRef = useRef<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [flatPosition, setFlatPosition] = useState<FlatLorePosition>({
    index: 0,
    total: 1,
    labels: ["Atlante"],
    depths: [0],
  });

  useEffect(() => {
    const root = rootRef.current;
    const element = root?.querySelector<HTMLElement>(".nation-lore-swiper");
    const pagination =
      root?.querySelector<HTMLElement>(".nation-swiper-pagination-engine");
    if (!root || !element || !pagination) return;

    const syncPosition = (outer: Swiper) => {
      const position = readFlatLorePosition(outer);
      setFlatPosition({
        ...position,
        index: pendingFlatTargetRef.current ?? position.index,
      });
    };
    const syncAtlasState = (instance: Swiper) => {
      const atlasActive = instance.activeIndex === 0;
      setActiveSlide(instance.activeIndex);
      root.classList.toggle("is-atlas-active", atlasActive);
      instance.allowTouchMove = !atlasActive;
      if (atlasActive) instance.mousewheel.disable();
      else instance.mousewheel.enable();
    };

    const swiper = new Swiper(element, {
      modules: [HashNavigation, Keyboard, Mousewheel, Pagination],
      direction: "vertical",
      slidesPerView: 1,
      speed: 800,
      threshold: 16,
      nested: true,
      keyboard: { enabled: true, onlyInViewport: true },
      mousewheel: { enabled: false, forceToAxis: true, releaseOnEdges: true },
      hashNavigation: { enabled: true, replaceState: true, watchState: true },
      pagination: {
        el: pagination,
        clickable: true,
        bulletClass: "nation-lore-bullet",
        bulletActiveClass: "is-active",
        renderBullet(_index, className) {
          return `<div role="button" tabindex="0" class="${className}"><span aria-hidden="true"></span><b></b></div>`;
        },
      },
      on: {
        init(instance) {
          syncAtlasState(instance);
          labelChapterPagination(instance);
          mountSubnavigation(instance);
          window.setTimeout(() => syncPosition(instance), 100);
        },
        slideChange(instance) {
          /*
           * Lo scroll legge l'articolo come un'unica sequenza. Quando si
           * attraversa il confine fra capitoli non ripristiniamo l'ultima
           * sottosezione visitata: entrando in avanti si parte dall'inizio,
           * tornando indietro si arriva alla fine del capitolo precedente.
           * Le selezioni esplicite dall'indice piatto impostano invece una
           * destinazione precisa e non devono essere sovrascritte.
           */
          if (
            pendingFlatTargetRef.current === null &&
            instance.activeIndex > 0
          ) {
            const nested = getNestedSwiper(instance.slides[instance.activeIndex]);
            if (nested) {
              const enteringForward =
                instance.activeIndex > instance.previousIndex;
              const target = enteringForward ? 0 : nested.slides.length - 1;
              if (nested.activeIndex !== target) nested.slideTo(target, 0);
            }
          }
          syncAtlasState(instance);
          onSlideChange();
          if (instance.activeIndex > 0) onAtlasLeave();
          labelChapterPagination(instance);
          mountSubnavigation(instance);
          window.setTimeout(() => syncPosition(instance), 100);
        },
        slideChangeTransitionStart() {
          root.classList.add("is-slide-moving");
        },
        slideChangeTransitionEnd(instance) {
          mountSubnavigation(instance);
          window.setTimeout(() => root.classList.remove("is-slide-moving"), 90);
        },
      },
    });

    swiperRef.current = swiper;
    const handleSubchapterChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ chapterId: string; index: number; total: number }>
      ).detail;
      if (swiper.slides[swiper.activeIndex]?.id === detail.chapterId) {
        syncPosition(swiper);
      }
      /*
       * Il cambio della slide annidata provoca un render React. Rimontiamo la
       * navigazione dopo quel render, evitando che torni dentro al capitolo e
       * scompaia dall'indice laterale.
       */
      window.requestAnimationFrame(() => mountSubnavigation(swiper));
    };
    const handleScrollBoundary = (event: Event) => {
      const { direction } = (
        event as CustomEvent<{ direction: "previous" | "next" }>
      ).detail;
      const nested = getNestedSwiper(swiper.slides[swiper.activeIndex]);

      if (nested) {
        if (direction === "previous" && nested.activeIndex > 0) {
          nested.slidePrev();
          return;
        }
        if (
          direction === "next" &&
          nested.activeIndex < nested.slides.length - 1
        ) {
          nested.slideNext();
          return;
        }
      }

      if (direction === "previous") swiper.slidePrev();
      else swiper.slideNext();
    };
    root.addEventListener("nation-subchapter-change", handleSubchapterChange);
    root.addEventListener("nation-scroll-boundary", handleScrollBoundary);

    return () => {
      root.removeEventListener(
        "nation-subchapter-change",
        handleSubchapterChange,
      );
      root.removeEventListener("nation-scroll-boundary", handleScrollBoundary);
      swiperRef.current = null;
      if (pendingFlatTimerRef.current !== null) {
        window.clearTimeout(pendingFlatTimerRef.current);
      }
      swiper.destroy(true, true);
    };
  }, [onAtlasLeave, onSlideChange, rootRef]);

  const navigateFlat = (target: number) => {
    if (swiperRef.current) {
      pendingFlatTargetRef.current = target;
      setFlatPosition((position) => ({ ...position, index: target }));
      navigateToFlatPosition(swiperRef.current, target);
      if (pendingFlatTimerRef.current !== null) {
        window.clearTimeout(pendingFlatTimerRef.current);
      }
      pendingFlatTimerRef.current = window.setTimeout(() => {
        pendingFlatTargetRef.current = null;
        if (swiperRef.current) {
          setFlatPosition(readFlatLorePosition(swiperRef.current));
        }
      }, (swiperRef.current.params.speed ?? 800) + 120);
    }
  };

  const navigateLore = (direction: "previous" | "next") => {
    const outer = swiperRef.current;
    if (!outer) return;

    if (
      direction === "previous" &&
      window.matchMedia(PORTRAIT_MOBILE_QUERY).matches
    ) {
      outer.slideTo(0);
      return;
    }

    const nested = getNestedSwiper(outer.slides[outer.activeIndex]);
    if (nested) {
      if (direction === "previous" && nested.activeIndex > 0) {
        nested.slidePrev();
        return;
      }
      if (
        direction === "next" &&
        nested.activeIndex < nested.slides.length - 1
      ) {
        nested.slideNext();
        return;
      }
    }
    if (direction === "previous") outer.slidePrev();
    else outer.slideNext();
  };

  return {
    activeSlide,
    flatPosition,
    navigateFlat,
    navigateLore,
    showNext: !(
      activeSlide > 0 &&
      flatPosition.total > 1 &&
      flatPosition.index === flatPosition.total - 1
    ),
    openLore: () => swiperRef.current?.slideNext(),
  };
}
