import { useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { besideRow } from "../besideRow";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { isFailure, isWaiting, useNotificationHistory, type NotificationEntry } from "./history";
import { NotificationGroup } from "./NotificationGroup";
import type { ToastAction } from "./types";

const WIDTH = 380;

type Filter = "all" | "needsYou" | "failed";

const FILTERS: { id: Filter; label: string; matches: (e: NotificationEntry) => boolean }[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "needsYou", label: "Needs you", matches: isWaiting },
  { id: "failed", label: "Failed", matches: isFailure },
];

interface NotificationCenterProps {
  anchor: DOMRect;
  onClose: () => void;
}

/** Every toast of this session, newest first, with its buttons still live. */
export function NotificationCenter({ anchor, onClose }: NotificationCenterProps) {
  const entries = useNotificationHistory((s) => s.entries);
  const { markRead, markAllRead, clear } = useNotificationHistory.getState();
  const [filter, setFilter] = useState<Filter>("all");
  // A click on the row that opened the list is left to that row, which toggles it shut.
  const panelRef = useOutsideClick<HTMLDivElement>((e) => {
    const onAnchor =
      e.clientX >= anchor.left && e.clientX <= anchor.right && e.clientY >= anchor.top && e.clientY <= anchor.bottom;
    if (!onAnchor) onClose();
  });

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useDismissOnEscape(true, onClose);
  // Measured on every render: the list grows as news lands while it's open.
  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight ?? 0;
    const next = besideRow(anchor, WIDTH, height);
    setPos((prev) => (prev?.top === next.top && prev.left === next.left ? prev : next));
  });

  const act = (entry: NotificationEntry, action: ToastAction) => {
    markRead(entry.id);
    action.onClick();
  };

  const { today, earlier, unread } = useMemo(() => {
    const matches = (FILTERS.find((f) => f.id === filter) ?? FILTERS[0]).matches;
    const midnight = new Date().setHours(0, 0, 0, 0);
    const shown = entries.filter(matches);
    return {
      today: shown.filter((e) => e.at >= midnight),
      earlier: shown.filter((e) => e.at < midnight),
      unread: {
        all: 0,
        needsYou: entries.filter((e) => !e.read && isWaiting(e)).length,
        failed: entries.filter((e) => !e.read && isFailure(e)).length,
      } satisfies Record<Filter, number>,
    };
  }, [entries, filter]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="fixed z-[90] flex max-h-[min(520px,80vh)] flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-2xl"
      style={{ width: WIDTH, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">Notifications</span>
        <div className="flex items-center">
          <button type="button" className="toast-button toast-button-quiet h-6 text-[12.5px]" onClick={markAllRead}>
            Mark all read
          </button>
          <button type="button" className="toast-button toast-button-quiet h-6 text-[12.5px]" onClick={clear}>
            Clear
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 px-3.5 pb-2" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] transition-colors ${
              filter === f.id
                ? "border-[var(--text-primary)] bg-[var(--text-primary)] font-medium text-[var(--bg-primary)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {f.label}
            {unread[f.id] > 0 && ` · ${unread[f.id]}`}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {today.length + earlier.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-[var(--text-muted)]">
            {entries.length === 0 ? "Nothing yet. Toasts land here once they've shown." : "Nothing here."}
          </p>
        ) : (
          <>
            <NotificationGroup title="Today" entries={today} onAct={act} />
            <NotificationGroup title="Earlier" entries={earlier} onAct={act} />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
