"use client";

import type { ReactNode } from "react";
import "./sidebar.css";

export type SidebarSide = "left" | "right";

export interface SidebarProps {
  id: string;
  open: boolean;
  side: SidebarSide;
  label: string;
  variant?: string;
  className?: string;
  children: ReactNode;
  onClose(): void;
}

/** Generic, reusable overlay sidebar. Layout-specific behavior is supplied by its consumer. */
export function Sidebar({
  id,
  open,
  side,
  label,
  variant = "default",
  className = "",
  children,
  onClose,
}: SidebarProps) {
  const classes = [
    "sidebar-panel",
    `sidebar-panel--${side}`,
    `sidebar-panel--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        className={`sidebar-scrim sidebar-scrim--${variant}`}
        data-open={open}
        type="button"
        aria-label={`Chiudi ${label}`}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id={id}
        className={classes}
        data-open={open}
        aria-label={label}
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  );
}
