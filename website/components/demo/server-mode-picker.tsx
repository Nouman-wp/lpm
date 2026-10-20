"use client";

import type { ReactNode } from "react";
import { Check, Clock, Server, SquareTerminal } from "lucide-react";
import { DrillPanel } from "./drill-panel";
import { FOCUS_RING } from "./ui";

type PointKind = "pro" | "time" | "plain";

const POINT_MARK: Record<PointKind, ReactNode> = {
  pro: <Check size={12} strokeWidth={2} className="text-[#4ade80]" />,
  time: <Clock size={12} strokeWidth={1.75} className="text-[#919191]" />,
  plain: <span className="h-px w-2.5 bg-[#919191]" />,
};

function Points({ points }: { points: { kind: PointKind; text: string }[] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5">
      {points.map((p) => (
        <li
          key={p.text}
          className="flex items-center gap-1.5 text-[11px] leading-relaxed text-[#b3b3b3]"
        >
          <span className="flex w-3 shrink-0 items-center justify-center">
            {POINT_MARK[p.kind]}
          </span>
          {p.text}
        </li>
      ))}
    </ul>
  );
}

// The app's Server screen: install lpm on the box, or reach one folder of it
// over SSH. Only SSH is simulated here.
export function ServerModePicker({
  onBack,
  onClose,
  onSsh,
}: {
  onBack: () => void;
  onClose: () => void;
  onSsh: (event: React.MouseEvent) => void;
}) {
  return (
    <DrillPanel title="Server" onBack={onBack} onClose={onClose}>
      <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1.5">
        <p className="text-[12px] text-[#b3b3b3]">How should lpm work with it?</p>
        <div
          aria-disabled="true"
          title="Installing lpm on a server happens in the app"
          className="flex items-start gap-3 rounded-xl border border-[#2e2e2e] p-3.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a2a2a] text-[#22d3ee]">
            <Server size={20} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#e5e5e5]">
                Install lpm there
              </span>
              <span className="rounded-full bg-[#4ade80]/10 px-1.5 text-[10px] font-medium leading-4 text-[#4ade80]">
                Recommended
              </span>
            </div>
            <Points
              points={[
                { kind: "pro", text: "Work keeps running when this Mac sleeps" },
                { kind: "pro", text: "Every project on it shows in your sidebar" },
                { kind: "time", text: "First setup takes a few minutes" },
              ]}
            />
            <p className="mt-2 text-[11px] text-[#919191]">Set up in the app</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSsh}
          data-tour="server-ssh"
          className={`group flex items-start gap-3 rounded-xl border border-[#2e2e2e] p-3.5 text-left transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a2a2a] text-[#60a5fa] transition-colors group-hover:bg-[#333333]">
            <SquareTerminal size={20} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[13px] font-medium text-[#e5e5e5]">Just SSH in</span>
            <Points
              points={[
                { kind: "pro", text: "Nothing is installed on the server" },
                { kind: "plain", text: "One folder per project, run from this Mac" },
              ]}
            />
          </div>
        </button>
      </div>
    </DrillPanel>
  );
}
