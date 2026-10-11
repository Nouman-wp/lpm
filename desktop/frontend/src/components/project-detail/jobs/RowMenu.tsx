import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "../../icons";

// The shell every row picker shares: a quiet right-aligned trigger showing the
// current value, opening an anchored menu. The menu is portaled with fixed
// positioning so it's never clipped by the modal's scroll container, and
// re-anchors on scroll/resize.
export function RowMenu({
  label,
  menuClassName,
  children,
}: {
  label: string;
  menuClassName: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Open downward when there's room, otherwise flip above the trigger; either
  // way cap the menu to the space actually available so it never runs off the
  // window (it scrolls internally instead).
  const reposition = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const right = window.innerWidth - r.right;
    const below = window.innerHeight - r.bottom - 18;
    const above = r.top - 18;
    if (below >= 200 || below >= above) {
      setPos({ top: r.bottom + 6, right, maxHeight: Math.min(320, below) });
    } else {
      setPos({
        bottom: window.innerHeight - r.top + 6,
        right,
        maxHeight: Math.min(320, above),
      });
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`-mr-1.5 flex max-w-[300px] items-center gap-1 rounded-md py-1 pl-2 pr-1.5 text-[13px] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${
          open ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 scale-75 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <ChevronDownIcon />
        </span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              top: pos.top,
              bottom: pos.bottom,
              right: pos.right,
              maxHeight: pos.maxHeight,
            }}
            className={`fixed z-[80] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl ${menuClassName}`}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
