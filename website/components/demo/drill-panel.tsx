"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { MenuCloseButton } from "./ui-kit";
import { FOCUS_RING } from "./ui";

// A screen the add-project picker drills into, like the app's DrillMenu: the
// same panel as the picker, with a back row titled after the screen.
export function DrillPanel({
  title,
  width = "w-[360px]",
  onBack,
  onClose,
  children,
}: {
  title: string;
  width?: string;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className={`relative flex max-h-full ${width} max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] py-1.5 shadow-2xl`}
    >
      <MenuCloseButton onClick={onClose} />
      <button
        type="button"
        onClick={onBack}
        className={`mx-2 mb-1 flex shrink-0 items-center gap-1 rounded-lg py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#b3b3b3]">
          <ChevronLeft size={14} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 truncate text-[12.5px] font-medium text-[#e5e5e5]">
          {title}
        </span>
      </button>
      {children}
    </div>
  );
}
