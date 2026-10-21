"use client";

import { Check, ChevronRight } from "lucide-react";
import { FOCUS_RING } from "./ui";

const INSET_ROW = `mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:opacity-40 ${FOCUS_RING}`;

// Ports the body of the app's Pull and Push screens: what a click on the row
// runs, the advanced flags behind it, and a run from here.
export function GitModeScreen<T extends string>({
  options,
  labels,
  value,
  busy,
  runLabel,
  onSelect,
  onAdvanced,
  onRun,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  busy: boolean;
  runLabel: string;
  onSelect: (value: T) => void;
  onAdvanced: () => void;
  onRun: () => void;
}) {
  return (
    <>
      <div className="px-4 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-[#919191]">
        Default on click
      </div>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={busy}
            className={INSET_ROW}
          >
            <span className="flex w-3.5 shrink-0">
              {active && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
            </span>
            <span className={active ? "text-[#e5e5e5]" : ""}>{labels[option]}</span>
          </button>
        );
      })}
      <div className="mx-3 my-1 border-t border-[#2e2e2e]" />
      <button type="button" onClick={onAdvanced} className={INSET_ROW}>
        Advanced flags
        <span className="ml-auto flex text-[#919191]">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className={`mx-1.5 mt-1 flex w-[calc(100%-12px)] items-center justify-center rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#4ade80] transition-colors hover:bg-[#2a2a2a] disabled:opacity-40 ${FOCUS_RING}`}
      >
        {runLabel}
      </button>
    </>
  );
}
