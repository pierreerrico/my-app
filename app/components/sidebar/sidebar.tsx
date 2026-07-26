"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "../scroll-area/scroll-area";
import "./sidebar.css";

export type SidebarSide = "left" | "right";

export interface SidebarProps {
  id: string;
  open: boolean;
  side: SidebarSide;
  label: string;
  variant?: string;
  className?: string;
  scrollbarClassName?: string;
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
  scrollbarClassName = "",
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
        <ScrollArea
          className={["sidebar-scroll-area", scrollbarClassName]
            .filter(Boolean)
            .join(" ")}
          viewportClassName="sidebar-scroll-viewport"
        >
          {children}
        </ScrollArea>
      </aside>
    </>
  );
}
