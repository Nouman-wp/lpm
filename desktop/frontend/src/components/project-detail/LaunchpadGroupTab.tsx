import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useAnchoredPanel } from "../../hooks/useAnchoredPanel";
import { useEventListener } from "../../hooks/useEventListener";
import type { LaunchpadOption, LaunchpadTab } from "../../launchpadAgentActions";
import { useOverlay } from "../../store/overlay";
import { AgentGlyph } from "../terminal/AgentGlyph";
import { launchpadTabClass } from "./launchpadTabStyle";

const PANEL_WIDTH = 240;

// A header split button or menu among the launchpad's tabs, working the same
// way: a split's main part picks the item it shows, its chevron (or a menu's
// whole button) opens the items to pick from.
export function LaunchpadGroupTab({
  tab,
  value,
  onChange,
}: {
  tab: LaunchpadTab;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef, style } = useAnchoredPanel<HTMLDivElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: PANEL_WIDTH,
    side: "below",
    align: "left",
    flip: true,
  });
  useOverlay(open);
  useEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
    },
    window,
    open,
  );

  const picked = tab.options.find((o) => o.id === value) ?? null;
  // A click leaves the keyboard in the prompt.
  const keepFocus = (e: MouseEvent) => e.preventDefault();
  const choose = (id: string) => {
    setOpen(false);
    onChange(id);
  };

  const chevron = <ChevronDown size={12} strokeWidth={2} className="shrink-0 opacity-70" />;
  const split = (lead: LaunchpadOption) => (
    <div className={`${launchpadTabClass(picked !== null, false)} gap-0`}>
      <button
        type="button"
        role="radio"
        aria-checked={picked !== null}
        onMouseDown={keepFocus}
        onClick={() => onChange(lead.id)}
        className={`flex h-full items-center gap-1.5 rounded-l-lg pl-2.5 pr-1.5 ${
          picked ? "" : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        }`}
      >
        <AgentGlyph agent={lead.agent} />
        {lead.label}
      </button>
      <button
        type="button"
        aria-label={`Pick from ${tab.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={keepFocus}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-full items-center rounded-r-lg pl-1 pr-1.5 ${
          open ? "bg-[var(--bg-hover)]" : picked ? "" : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        }`}
      >
        {chevron}
      </button>
    </div>
  );

  return (
    <div ref={triggerRef}>
      {tab.primary ? (
        split(picked ?? tab.primary)
      ) : (
        <button
          type="button"
          role="radio"
          aria-checked={picked !== null}
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={keepFocus}
          onClick={() => setOpen((v) => !v)}
          className={`${launchpadTabClass(picked !== null)} px-2.5`}
        >
          <AgentGlyph agent={(picked ?? tab.options[0]).agent} />
          {picked?.label ?? tab.label}
          {chevron}
        </button>
      )}
      {open &&
        style &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            role="menu"
            aria-label={tab.label}
            className="z-[80] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] py-1.5 shadow-2xl"
          >
            {tab.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === value}
                onMouseDown={keepFocus}
                onClick={() => choose(o.id)}
                className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <AgentGlyph agent={o.agent} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.id === value && <Check size={14} strokeWidth={2} className="shrink-0 text-[var(--text-primary)]" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
