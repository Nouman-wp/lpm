import { useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuShell } from "../ui/ContextMenuShell";

export interface StripEntry {
  key: string;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

interface TabOverflowChipProps {
  side: "left" | "right";
  // The tabs past this edge, in strip order.
  entries: StripEntry[];
  onSelect: (key: string) => void;
}

// Sits over a tab strip's edge while tabs are scrolled past it: how many, and
// a list of them to jump to. Covers the edge so no tab shows cut in half.
export function TabOverflowChip({ side, entries, onSelect }: TabOverflowChipProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  if (entries.length === 0) return null;
  const left = side === "left";
  const count = entries.length;
  return (
    <div
      className={`absolute inset-y-0 z-20 flex items-center from-[var(--terminal-header)] from-60% to-transparent ${
        left ? "left-0 bg-gradient-to-r pr-4" : "right-0 bg-gradient-to-l pl-4"
      }`}
    >
      <button
        type="button"
        // Its own click toggles the list, so the list's outside-click close
        // mustn't see it first and reopen it.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setMenu(menu ? null : { x: left ? box.left : box.right, y: box.bottom + 4 });
        }}
        aria-label={`${count} more ${count === 1 ? "tab" : "tabs"} to the ${side}`}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        className={`flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-[var(--terminal-header-hover)] px-1.5 font-mono text-[11px] font-medium tabular-nums text-[var(--terminal-header-text)] transition-colors hover:bg-[var(--terminal-header-active)] hover:text-[var(--terminal-tab-active)] [&_svg]:h-3 [&_svg]:w-3 ${
          menu ? "bg-[var(--terminal-header-active)] text-[var(--terminal-tab-active)]" : ""
        }`}
      >
        {left && <ChevronLeftIcon />}
        {count}
        {!left && <ChevronRightIcon />}
      </button>
      {menu && (
        <ContextMenuShell x={menu.x} y={menu.y} align={left ? "start" : "end"} onClose={() => setMenu(null)}>
          {entries.map((entry) => (
            <ContextMenuItem
              key={entry.key}
              label={entry.label}
              icon={entry.icon}
              trailing={entry.trailing}
              onClick={() => {
                setMenu(null);
                onSelect(entry.key);
              }}
            />
          ))}
        </ContextMenuShell>
      )}
    </div>
  );
}
