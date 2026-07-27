"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import "./circle-control.css";

type CircleIcon =
  | "menu"
  | "info"
  | "book"
  | "up"
  | "down"
  | "quote"
  | "navigation";

interface CircleControlProps extends HTMLMotionProps<"button"> {
  icon: CircleIcon;
  active?: boolean;
}

const iconTransition = {
  duration: 0.34,
  ease: [0.22, 0.8, 0.2, 1] as const,
};

const PROGRESS_DRAW_DURATION_MS = 480;
const PROGRESS_FULL_HOLD_MS = 24;
const PROGRESS_ERASE_DURATION_MS = 430;

type ProgressPhase = "idle" | "hover" | "erase";

export function CircleControl({
  icon,
  active = false,
  className = "",
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onBlur,
  ...props
}: CircleControlProps) {
  const [progressPhase, setProgressPhase] =
    useState<ProgressPhase>("idle");
  const eraseTimer = useRef<number | null>(null);
  const touchReleaseTimer = useRef<number | null>(null);
  const touchDrawStartedAt = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (eraseTimer.current !== null) {
        window.clearTimeout(eraseTimer.current);
      }

      if (touchReleaseTimer.current !== null) {
        window.clearTimeout(touchReleaseTimer.current);
      }
    };
  }, []);

  const clearEraseTimer = () => {
    if (eraseTimer.current !== null) {
      window.clearTimeout(eraseTimer.current);
      eraseTimer.current = null;
    }
  };

  const clearTouchReleaseTimer = () => {
    if (touchReleaseTimer.current !== null) {
      window.clearTimeout(touchReleaseTimer.current);
      touchReleaseTimer.current = null;
    }
  };

  const startErase = () => {
    clearEraseTimer();
    setProgressPhase("erase");

    eraseTimer.current = window.setTimeout(() => {
      setProgressPhase("idle");
      eraseTimer.current = null;
    }, PROGRESS_ERASE_DURATION_MS);
  };

  const resetProgress = () => {
    clearEraseTimer();
    clearTouchReleaseTimer();
    touchDrawStartedAt.current = null;
    setProgressPhase("idle");
  };

  const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    // Su touch non esiste un vero hover: alcuni browser sintetizzano uno stato
    // persistente dopo il tap. Il progress hover viene quindi attivato qui solo
    // da un puntatore mouse reale.
    if (event.pointerType === "mouse") {
      clearEraseTimer();
      setProgressPhase("hover");
    }

    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      startErase();
    }

    onPointerLeave?.(event);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") {
      clearEraseTimer();
      clearTouchReleaseTimer();
      touchDrawStartedAt.current = performance.now();
      setProgressPhase("hover");
    }

    onPointerDown?.(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") {
      clearTouchReleaseTimer();

      const elapsed = touchDrawStartedAt.current === null
        ? 0
        : performance.now() - touchDrawStartedAt.current;
      const remainingDrawTime = Math.max(0, PROGRESS_DRAW_DURATION_MS - elapsed);

      // Anche con un tap molto rapido il ring completa il giro, resta pieno
      // per un istante leggibile e soltanto dopo avvia la cancellazione.
      touchReleaseTimer.current = window.setTimeout(() => {
        touchReleaseTimer.current = null;
        touchDrawStartedAt.current = null;
        startErase();
      }, remainingDrawTime + PROGRESS_FULL_HOLD_MS);
    }

    onPointerUp?.(event);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") {
      resetProgress();
    }

    onPointerCancel?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    resetProgress();
    onBlur?.(event);
  };

  return (
    <motion.button
      {...props}
      className={`nation-circle-control ${active ? "is-control-active" : ""} is-progress-${progressPhase} ${className}`.trim()}
      data-control-icon={icon}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onBlur={handleBlur}
    >
      <ControlIcon icon={icon} active={active} />
    </motion.button>
  );
}

function ControlIcon({ icon, active }: { icon: CircleIcon; active: boolean }) {
  if (icon === "menu") {
    return (
      <motion.svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={active ? "M6 6 18 18" : "M5 7 19 7"} />
        <motion.path
          d="M5 12 19 12"
          initial={{ opacity: 1, pathLength: 1 }}
          animate={{ opacity: active ? 0 : 1, pathLength: active ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
        <path d={active ? "M18 6 6 18" : "M5 17 19 17"} />
      </motion.svg>
    );
  }

  if (icon === "info") {
    return (
      <motion.svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={active ? "M6 6 18 18" : "M12 10 12 18"} />
        <path d={active ? "M18 6 6 18" : "M12 6 12.01 6"} />
      </motion.svg>
    );
  }

  if (icon === "up") {
    return (
      <motion.svg viewBox="0 0 24 24" aria-hidden="true">
        <motion.path
          className="nation-primary-chevron"
          d="M6 15 12 9 18 15"
          initial={{ pathLength: 0.72, opacity: 0.82 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={iconTransition}
        />
        <motion.path
          className="nation-mobile-double-chevron"
          d="M6 18 12 12 18 18"
          initial={{ pathLength: 0.72, opacity: 0.82 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={iconTransition}
        />
      </motion.svg>
    );
  }

  const paths = {
    book: [
      "M3.5 5.5A3.5 3.5 0 0 1 7 2h5v17H7a3.5 3.5 0 0 0-3.5 3V5.5Z",
      "M20.5 5.5A3.5 3.5 0 0 0 17 2h-5v17h5a3.5 3.5 0 0 1 3.5 3V5.5Z",
    ],
    down: ["M6 9 12 15 18 9"],
    quote: [
      "M6.5 8.5h4v4h-3v3h-3v-4c0-1.7.7-3 2-4",
      "M15.5 8.5h4v4h-3v3h-3v-4c0-1.7.7-3 2-4",
    ],
    navigation: ["M12 5 19 18H5L12 5Z"],
  }[icon];

  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((path) => (
        <motion.path
          d={path}
          key={path}
          initial={{ pathLength: 0.72, opacity: 0.82 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={iconTransition}
        />
      ))}
    </motion.svg>
  );
}
