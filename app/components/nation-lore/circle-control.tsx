"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState } from "react";
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

export function CircleControl({
  icon,
  active = false,
  className = "",
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: CircleControlProps) {
  const [holding, setHolding] = useState(false);
  const releaseTimer = useRef<number | null>(null);

  const holdAfterRelease = () => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    setHolding(true);
    releaseTimer.current = window.setTimeout(() => {
      setHolding(false);
      releaseTimer.current = null;
    }, 820);
  };

  useEffect(() => () => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
  }, []);

  return (
    <motion.button
      {...props}
      className={`nation-circle-control ${active ? "is-control-active" : ""} ${holding ? "is-control-hold" : ""} ${className}`.trim()}
      data-control-icon={icon}
      onPointerDown={(event) => {
        if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
        setHolding(false);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        holdAfterRelease();
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        holdAfterRelease();
        onPointerCancel?.(event);
      }}
    >
      <ControlIcon icon={icon} active={active} />
    </motion.button>
  );
}

function ControlIcon({ icon, active }: { icon: CircleIcon; active: boolean }) {
  if (icon === "menu") {
    return (
      <motion.svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={active ? "M6 6 18 18" : "M5 7 19 7"}
        />
        <motion.path
          d="M5 12 19 12"
          initial={{ opacity: 1, pathLength: 1 }}
          animate={{ opacity: active ? 0 : 1, pathLength: active ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
        <path
          d={active ? "M18 6 6 18" : "M5 17 19 17"}
        />
      </motion.svg>
    );
  }

  if (icon === "info") {
    return (
      <motion.svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={active ? "M6 6 18 18" : "M12 10 12 18"}
        />
        <path
          d={active ? "M18 6 6 18" : "M12 6 12.01 6"}
        />
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
