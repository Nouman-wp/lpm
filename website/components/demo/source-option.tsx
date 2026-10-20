"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { FOCUS_RING } from "./ui";

export function SourceOption({
  icon,
  color,
  label,
  desc,
  onClick,
  tourTarget,
  drills = false,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  desc: string;
  onClick: () => void;
  tourTarget?: string;
  drills?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourTarget}
      className={`group flex items-start gap-3.5 rounded-xl px-4 py-3.5 text-left transition-all hover:bg-[#2a2a2a] ${FOCUS_RING}`}
    >
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2a2a2a] transition-colors group-hover:bg-[#333333]"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[13px] font-medium text-[#e5e5e5]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-[#b3b3b3]">
          {desc}
        </div>
      </div>
      {drills && (
        <span className="mt-2 flex shrink-0 text-[#919191]">
          <ChevronRight size={14} strokeWidth={1.5} />
        </span>
      )}
    </button>
  );
}
