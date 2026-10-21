"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { FOCUS_RING } from "./ui";

// Ports the app's MenuSplitRow: the row runs its default, the chevron opens
// its settings.
export function MenuSplitRow({
  icon,
  label,
  configureLabel,
  disabled,
  onRun,
  onConfigure,
}: {
  icon: ReactNode;
  label: string;
  configureLabel: string;
  disabled?: boolean;
  onRun: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className="mx-1.5 flex items-center overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className={`flex flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:opacity-40 ${FOCUS_RING}`}
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        onClick={onConfigure}
        disabled={disabled}
        title="Configure"
        aria-label={configureLabel}
        className={`flex items-center border-l border-[#2e2e2e] px-2.5 py-2 text-[#919191] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:opacity-40 ${FOCUS_RING}`}
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      </button>
    </div>
  );
}
