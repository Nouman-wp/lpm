"use client";

import type { ReactNode } from "react";
import { FOCUS_RING } from "./ui";

// Ports the app's LaunchpadRadioTab: one tab in the launcher's row, picking
// where the prompt goes.
export function LaunchpadTab({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-medium transition-colors [&>svg]:h-[14px] [&>svg]:w-[14px] ${FOCUS_RING} ${
        checked
          ? "bg-[#333333] text-[#cccccc]"
          : "text-[#a8a8a8] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#cccccc]"
      }`}
    >
      {children}
    </button>
  );
}
