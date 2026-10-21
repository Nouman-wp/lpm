"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const MARGIN = 8;
const WIDTH = 360;

// Ports the app's SidebarUsagePopover: the full usage card beside a sidebar
// row, bottom-aligned with it, measured before it shows so it never flashes in
// the wrong place.
export function SidebarUsagePopover({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    const top = Math.max(MARGIN, Math.min(anchor.bottom - height, window.innerHeight - height - MARGIN));
    const right = anchor.right + GAP;
    const left =
      right + WIDTH > window.innerWidth - MARGIN ? Math.max(MARGIN, anchor.left - WIDTH - GAP) : right;
    setPos({ top, left });
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: WIDTH,
        visibility: pos ? "visible" : "hidden",
      }}
      className="replica-ui menu-pop pointer-events-none fixed z-[9999] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.12),0_12px_32px_rgba(0,0,0,0.32)]"
    >
      {children}
    </div>,
    document.body,
  );
}
