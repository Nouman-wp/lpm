import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useAnchoredPanel } from "../../hooks/useAnchoredPanel";
import { useDismissOnEscape } from "../../hooks/useDismissOnEscape";
import { levelName, modelName, newTabModelLabel, type NewTabPick } from "../../newTabPick";
import { useOverlay } from "../../store/overlay";
import { AI_CLI_OPTIONS } from "../../types";
import { LauncherModelChoices } from "../terminal/LauncherModelChoices";

const PANEL_WIDTH = 300;

// The model and level the launchpad's agent opens with, beside Start; the
// pills are the + popup's.
export function LaunchpadModelMenu({
  pick,
  onChange,
}: {
  pick: NewTabPick;
  onChange: (pick: NewTabPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef, style } = useAnchoredPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: PANEL_WIDTH,
    side: "below",
    align: "right",
    flip: true,
  });
  useOverlay(open);
  useDismissOnEscape(open, () => setOpen(false));

  const summary = newTabModelLabel(pick);
  if (!summary) return null;
  const agentLabel = AI_CLI_OPTIONS.find((o) => o.value === pick.agent)?.label ?? pick.agent;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${agentLabel} model and level: ${summary}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 min-w-0 shrink items-center gap-1.5 rounded-lg px-2 text-[12px] leading-none transition-colors hover:bg-[var(--bg-hover)] ${
          open ? "bg-[var(--bg-hover)]" : ""
        }`}
      >
        <span className="min-w-0 truncate text-[var(--text-primary)]">{modelName(pick.agent, pick.model)}</span>
        {pick.effort && (
          <span className="shrink-0 text-[var(--text-muted)]">{levelName(pick.agent, pick.model, pick.effort)}</span>
        )}
        <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-[var(--text-muted)]" />
      </button>
      {open &&
        style &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            role="dialog"
            aria-label={`${agentLabel} model and level`}
            className="z-[80] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 pb-3 pt-2.5 shadow-xl"
          >
            <LauncherModelChoices pick={pick} onChange={onChange} />
          </div>,
          document.body,
        )}
    </>
  );
}
