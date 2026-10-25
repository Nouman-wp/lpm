import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { besideRow } from "../besideRow";

export const USAGE_POPOVER_WIDTH = 360;

/** Floats the full usage card beside a sidebar row. Portaled so the sidebar's
 *  own scrolling and stacking cannot clip it, and measured before it is shown
 *  so it never flashes in the wrong place. */
export function SidebarUsagePopover({
  anchor,
  children,
}: {
  anchor: DOMRect;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(besideRow(anchor, USAGE_POPOVER_WIDTH, el.offsetHeight));
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: USAGE_POPOVER_WIDTH,
        visibility: pos ? "visible" : "hidden",
      }}
      className="tooltip-in pointer-events-none fixed z-[9999] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.12),0_12px_32px_rgba(0,0,0,0.32)]"
    >
      {children}
    </div>,
    document.body,
  );
}
