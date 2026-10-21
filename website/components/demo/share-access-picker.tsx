"use client";

import type { ReactNode } from "react";
import { Eye, Keyboard, TriangleAlert } from "lucide-react";
import { FOCUS_RING } from "./ui";

// Ports the app's ShareAccessPicker: what people let in from now on may do.
// Those already in keep theirs, and change one by one in the list below.
export function ShareAccessPicker({
  canType,
  onChange,
}: {
  canType: boolean;
  onChange: (canType: boolean) => void;
}) {
  const option = (value: boolean, label: string, icon: ReactNode) => {
    const on = canType === value;
    const tone = on
      ? value
        ? "bg-[#fbbf24]/15 text-[#fbbf24]"
        : "bg-[#333333] text-[#e5e5e5]"
      : "text-[#919191] hover:text-[#b3b3b3]";
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(value)}
        className={`flex h-[34px] items-center justify-center gap-[7px] rounded-lg text-[13px] font-medium transition-colors ${tone} ${FOCUS_RING}`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#919191]">
        People you let in can
      </div>
      <div
        role="radiogroup"
        aria-label="What people you let in can do"
        className="mt-2 grid grid-cols-2 gap-1.5 rounded-[10px] bg-[#242424] p-[3px]"
      >
        {option(false, "Watch", <Eye size={14} />)}
        {option(true, "Watch and type", <Keyboard size={14} />)}
      </div>
      {canType && (
        <div className="mt-2 flex gap-2 rounded-lg bg-[#fbbf24]/10 px-[11px] py-[9px] text-xs leading-[1.45] text-[#fbbf24]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>They can run commands on this Mac from this tab. You can take it back any time.</span>
        </div>
      )}
    </div>
  );
}
