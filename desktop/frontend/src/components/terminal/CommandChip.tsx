import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Play, SquareTerminal, TriangleAlert } from "lucide-react";
import { SetClipboardText } from "../../../bridge/commands";
import { isMac } from "../../platform";
import {
  hideCommandChip,
  keepCommandChip,
  leaveCommand,
  type CommandChipTarget,
} from "../../store/commandChip";
import { placeCommandChip } from "./commandChipPlacement";

type Where = "here" | "tab";

interface CommandChipProps {
  target: CommandChipTarget;
  onRun: (target: CommandChipTarget) => void;
  onRunInNewTab: (target: CommandChipTarget) => void;
}

const BUTTON =
  "inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]";
const SEPARATOR = "h-3.5 w-px shrink-0 bg-[var(--border)]";

// Next to a command in a terminal's output: run it with its output in a card,
// run it in a new tab, or copy it. A risky command asks once more first.
export function CommandChip({ target, onRun, onRunInNewTab }: CommandChipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [armed, setArmed] = useState<Where | null>(target.armed ? "here" : null);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlace(placeCommandChip(target.anchor, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [target.anchor, armed, copied]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const go = (where: Where) => {
    if (target.risk && armed !== where) {
      setArmed(where);
      return;
    }
    hideCommandChip();
    if (where === "here") onRun(target);
    else onRunInNewTab(target);
  };

  const copy = () => {
    void SetClipboardText(target.command)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  return createPortal(
    <div
      ref={ref}
      role="toolbar"
      aria-label={target.command}
      data-command-chip
      onMouseEnter={keepCommandChip}
      onMouseLeave={leaveCommand}
      style={{ ...place, visibility: place ? "visible" : "hidden" }}
      className={`fixed left-0 top-0 z-50 flex items-center gap-0.5 whitespace-nowrap rounded-lg border p-0.5 text-[11.5px] shadow-[0_6px_18px_rgba(0,0,0,0.3)] ${
        armed
          ? "border-[color-mix(in_srgb,var(--accent-amber)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent-amber)_10%,var(--bg-secondary))]"
          : "border-[var(--border)] bg-[var(--bg-secondary)]"
      }`}
    >
      {armed ? (
        <>
          <span className="flex items-center gap-1.5 px-1.5 text-[var(--text-primary)]">
            <TriangleAlert size={12} className="text-[var(--accent-amber)]" />
            {target.risk}
          </span>
          <button type="button" onClick={() => go(armed)} className={`${BUTTON} font-semibold text-[var(--accent-amber-text)]`}>
            {armed === "here" ? "Run anyway" : "Run in new tab anyway"}
          </button>
          <button type="button" onClick={() => setArmed(null)} className={BUTTON}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => go("here")}
            title={`Run and show the output (${isMac ? "⌘" : "Ctrl"}-click the command)`}
            className={BUTTON}
          >
            <Play
              size={10}
              className={target.risk ? "fill-[var(--accent-amber)] text-[var(--accent-amber)]" : "fill-[var(--accent-green)] text-[var(--accent-green)]"}
            />
            Run
          </button>
          <span className={SEPARATOR} />
          <button type="button" onClick={() => go("tab")} className={BUTTON}>
            <SquareTerminal size={12} className="text-[var(--text-muted)]" />
            Run in new tab
          </button>
          <span className={SEPARATOR} />
          <button type="button" onClick={copy} aria-label="Copy the command" title="Copy the command" className={`${BUTTON} px-1.5`}>
            {copied ? <Check size={12} className="text-[var(--accent-green)]" /> : <Copy size={12} className="text-[var(--text-muted)]" />}
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
