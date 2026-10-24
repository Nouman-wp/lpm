import { useMemo, useState } from "react";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { launchOpenFileTarget, useOpenFileTargets } from "../hooks/useOpenFileTargets";
import type { OpenInTarget } from "../hooks/useOpenInTargets";
import { OpenTargetIcon } from "./OpenTargetIcon";

const SELECTED_KEY = "lpm.openFileWith.selectedId";

interface OpenFileWithDropdownProps {
  absPath: string;
  line: number;
  col: number;
  // Header-sized: a shorter button that reads "Open" beside the app's icon.
  compact?: boolean;
}

export function OpenFileWithDropdown({ absPath, line, col, compact = false }: OpenFileWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const targets = useOpenFileTargets(absPath);
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem(SELECTED_KEY) ?? "",
  );
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false), open);

  const selected = useMemo(() => {
    return targets.find((t) => t.id === selectedId) ?? targets[0];
  }, [targets, selectedId]);

  if (!selected) return null;

  const launch = (t: OpenInTarget) => launchOpenFileTarget(t, absPath, line, col);

  const pick = (t: OpenInTarget) => {
    setSelectedId(t.id);
    localStorage.setItem(SELECTED_KEY, t.id);
    setOpen(false);
    void launch(t);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <div className={`inline-flex items-stretch border border-[var(--border)] ${compact ? "rounded-md" : "rounded-lg"}`}>
        <button
          onClick={() => void launch(selected)}
          title={`Open in ${selected.label}`}
          className={`flex items-center border-r border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${
            compact ? "gap-1.5 rounded-l-md px-2 py-1 text-[11px]" : "gap-2 rounded-l-lg px-2.5 py-1.5 text-[13px]"
          }`}
        >
          <OpenTargetIcon target={selected} />
          <span>{compact ? "Open" : `Open in ${selected.label}`}</span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          title="Choose app"
          className={`flex items-center transition-colors hover:bg-[var(--bg-hover)] ${compact ? "rounded-r-md px-1" : "rounded-r-lg px-1.5"} ${
            open ? "bg-[var(--bg-active)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          <ChevronDown />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] py-1.5 shadow-2xl">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ${
                t.id === selected.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <OpenTargetIcon target={t} />
              <span className="flex-1 truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
