"use client";

import { AiSparkleIcon } from "./git-menu-icons";
import { FOCUS_RING } from "./ui";

// One of the git menu's AI rows: what it does, and a spin while the AI writes.
export function AiGitRow({
  label,
  description,
  generating,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  generating: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
    >
      <span className={`mt-0.5 flex text-[#b3b3b3] ${generating ? "animate-spin" : ""}`}>
        <AiSparkleIcon />
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] text-[#b3b3b3] group-hover:text-[#e5e5e5]">
          {generating ? "Generating…" : label}
        </span>
        <span className="text-[11px] text-[#919191]">{description}</span>
      </span>
    </button>
  );
}
