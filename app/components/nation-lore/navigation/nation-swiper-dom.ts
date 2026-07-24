import type Swiper from "swiper";

export interface FlatLorePosition {
  index: number;
  total: number;
  labels: string[];
  depths: number[];
}

type SwiperElement = HTMLElement & { swiper?: Swiper };

const SUBCHAPTER_SWIPER = ".nation-subchapter-swiper";

export function getNestedSwiper(slide?: Element | null): Swiper | undefined {
  return slide?.querySelector<SwiperElement>(SUBCHAPTER_SWIPER)?.swiper;
}

export function readFlatLorePosition(outer: Swiper): FlatLorePosition {
  let total = 1;
  let index = outer.activeIndex === 0 ? 0 : 1;
  const labels = ["Atlante"];
  const depths = [0];

  for (let outerIndex = 1; outerIndex < outer.slides.length; outerIndex += 1) {
    const slide = outer.slides[outerIndex];
    const nestedElement = slide?.querySelector<SwiperElement>(SUBCHAPTER_SWIPER);
    const nestedSlides = Array.from(
      nestedElement?.querySelectorAll<HTMLElement>(
        ":scope > .swiper-wrapper > .swiper-slide",
      ) ?? [],
    );
    const nestedCount = nestedElement?.swiper?.slides.length ?? 1;

    if (nestedSlides.length > 0) {
      nestedSlides.forEach((nestedSlide, nestedIndex) => {
        labels.push(
          nestedSlide.querySelector("h2")?.textContent?.trim() ||
            slide?.getAttribute("aria-label") ||
            "Sezione",
        );
        depths.push(nestedIndex === 0 ? 0 : 1);
      });
    } else {
      labels.push(slide?.getAttribute("aria-label") ?? "Sezione");
      depths.push(0);
    }

    if (outerIndex < outer.activeIndex) index += nestedCount;
    if (outerIndex === outer.activeIndex) {
      index += nestedElement?.swiper?.activeIndex ?? 0;
    }
    total += nestedCount;
  }

  return { index, total, labels, depths };
}

export function navigateToFlatPosition(outer: Swiper, target: number) {
  if (target <= 0) {
    outer.slideTo(0);
    return;
  }

  let cursor = 1;
  for (let outerIndex = 1; outerIndex < outer.slides.length; outerIndex += 1) {
    const nested = getNestedSwiper(outer.slides[outerIndex]);
    const count = nested?.slides.length ?? 1;

    if (target < cursor + count) {
      const nestedTarget = target - cursor;
      if (outer.activeIndex === outerIndex) {
        nested?.slideTo(nestedTarget);
        return;
      }
      outer.once("slideChangeTransitionEnd", () =>
        getNestedSwiper(outer.slides[outerIndex])?.slideTo(nestedTarget),
      );
      outer.slideTo(outerIndex);
      return;
    }
    cursor += count;
  }
}

export function labelChapterPagination(swiper: Swiper) {
  const bullets = Array.from(
    swiper.el.closest(".nation-lore-page")?.querySelectorAll<HTMLElement>(
      ".nation-lore-bullet",
    ) ?? [],
  );

  bullets.forEach((bullet, index) => {
    const slide = swiper.slides[index];
    const label =
      index === 0
        ? "Atlante"
        : slide?.getAttribute("aria-label") ?? `Sezione ${index}`;
    const text = bullet.querySelector<HTMLElement>("b");

    if (text) text.textContent = label;
    bullet.setAttribute("aria-label", `Vai a ${label}`);
  });
}

export function mountSubnavigation(swiper: Swiper) {
  const root = swiper.el.closest<HTMLElement>(".nation-lore-page");
  if (!root) return;

  const chapterBullets = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".nation-lore-pagination > .nation-lore-bullet",
    ),
  );
  swiper.slides.forEach((slide, index) => {
    if (index === 0) return;
    const bullet = chapterBullets[index];
    const source = slide.querySelector<HTMLElement>(
      ".nation-subchapter-pagination-source",
    );
    if (!bullet || !source) return;

    const sourceButtons = Array.from(
      source.querySelectorAll<HTMLButtonElement>("button"),
    );
    let navigation = bullet.querySelector<HTMLElement>(
      ":scope > .nation-subchapter-pagination",
    );

    if (
      !navigation ||
      navigation.childElementCount !== sourceButtons.length
    ) {
      navigation?.remove();
      navigation = document.createElement("nav");
      navigation.className = "nation-subchapter-pagination";
      navigation.dataset.chapterId = slide.id;
      navigation.setAttribute(
        "aria-label",
        source.getAttribute("aria-label") ?? "Sottocapitoli",
      );

      sourceButtons.forEach((sourceButton, subchapterIndex) => {
        const button = document.createElement("button");
        const marker = document.createElement("span");
        const label = document.createElement("b");

        button.type = "button";
        marker.setAttribute("aria-hidden", "true");
        label.textContent = sourceButton.textContent?.trim() ?? "Sezione";
        button.append(marker, label);
        button.addEventListener("pointerdown", (event) =>
          event.stopPropagation(),
        );
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          /*
           * Il sottobullet è un controllo autonomo: porta prima al capitolo
           * corretto e soltanto dopo seleziona la sua slide annidata.
           * In questo modo funziona anche quando il parent non è attivo.
           */
          if (swiper.activeIndex !== index) {
            swiper.once("slideChangeTransitionEnd", () =>
              getNestedSwiper(slide)?.slideTo(subchapterIndex),
            );
            swiper.slideTo(index);
            return;
          }
          getNestedSwiper(slide)?.slideTo(subchapterIndex);
        });
        navigation?.appendChild(button);
      });

      bullet.appendChild(navigation);
    }

    const activeIndex =
      getNestedSwiper(slide)?.activeIndex ??
      Number(source.dataset.activeSubchapter ?? 0);
    Array.from(navigation.querySelectorAll<HTMLButtonElement>("button")).forEach(
      (button, subchapterIndex) => {
        const active = subchapterIndex === activeIndex;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      },
    );
  });
}
