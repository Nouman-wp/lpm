"use client";

import { Check } from "lucide-react";
import { FOCUS_RING } from "./ui";

// Ports the app's FlagRow: a git flag the default run adds when it's ticked.
export function FlagRow({
  label,
  flag,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  flag: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:opacity-40 ${FOCUS_RING}`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
          checked ? "border-[#4ade80] bg-[#4ade80] text-white" : "border-[#2e2e2e]"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </span>
      <span className={checked ? "text-[#e5e5e5]" : ""}>{label}</span>
      <span className="ml-auto font-mono text-[11px] text-[#919191]">{flag}</span>
    </button>
  );
}
