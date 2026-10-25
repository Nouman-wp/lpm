import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreVerticalIcon } from "../icons";
import { ContextMenuShell } from "../ui/ContextMenuShell";
import { ContextMenuItem } from "../ui/ContextMenuItem";

const MENU_WIDTH = 176;

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

// The row actions that shouldn't sit inline: they're rare, or destructive, and
// spelled out next to an on/off switch they read as equally routine as it.
//
// The panel is portaled to the body because the settings pane animates in, and
// an animated transform makes the pane the containing block for anything fixed
// inside it — the menu would be positioned against the pane and then clipped
// away by the scroll container, i.e. the button would look dead.
export function RowMenu({ items, ariaLabel }: { items: RowMenuItem[]; ariaLabel: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={anchor !== null}
        title={ariaLabel}
        // Without this the shell's outside-click (a mousedown) closes the menu
        // before the click lands, and the click would reopen what it meant to shut.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${
          anchor ? "bg-[var(--bg-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"
        }`}
      >
        <MoreVerticalIcon />
      </button>
      {anchor &&
        createPortal(
          <ContextMenuShell anchor={anchor} align="end" minWidth={MENU_WIDTH} onClose={() => setAnchor(null)}>
            {items.map((item) => (
              <ContextMenuItem
                key={item.label}
                label={item.label}
                disabled={item.disabled}
                destructive={item.destructive}
                onClick={() => {
                  setAnchor(null);
                  item.onClick();
                }}
              />
            ))}
          </ContextMenuShell>,
          document.body,
        )}
    </>
  );
}
