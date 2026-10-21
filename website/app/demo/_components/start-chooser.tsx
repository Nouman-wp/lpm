"use client";

import type { ReactNode } from "react";
import { FolderPlus, Sparkles } from "lucide-react";

export type DemoStart = "sample" | "empty";

function Option({
  icon,
  title,
  body,
  recommended = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer gap-3.5 rounded-xl border p-4 text-left transition-colors ${
        recommended
          ? "border-[#4a4a4a] bg-[#262626] hover:border-[#5c5c5c]"
          : "border-[#333] hover:border-[#4a4a4a] hover:bg-white/[0.03]"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2f2f2f] text-[#e5e5e5]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[#f5f5f5]">
          {title}
          {recommended && (
            <span className="rounded-full border border-emerald-400/30 px-2 text-[10px] font-semibold uppercase leading-[18px] tracking-wider text-emerald-300">
              Recommended
            </span>
          )}
        </span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-[#a3a3a3]">
          {body}
        </span>
      </span>
    </button>
  );
}

export function StartChooser({
  onPick,
}: {
  onPick: (start: DemoStart) => void;
}) {
  return (
    <div
      data-on-dark
      className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-[#1a1a1a]/75 p-6 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[#333] bg-[#1c1c1c] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <h2 className="text-[17px] font-semibold text-[#fafafa]">
          How do you want to start?
        </h2>
        <p className="mt-1 text-[13px] text-[#a3a3a3]">
          Everything runs in this tab. Nothing is installed.
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          <Option
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            title="Sample workspace"
            body="Five projects with dev servers and agent sessions already open. A five-step tour shows the main moves."
            recommended
            onClick={() => onPick("sample")}
          />
          <Option
            icon={<FolderPlus className="h-4 w-4" aria-hidden="true" />}
            title="Empty, like a fresh install"
            body="Add a folder, clone a repo or connect an SSH host, the way you would on day one."
            onClick={() => onPick("empty")}
          />
        </div>
      </div>
    </div>
  );
}
