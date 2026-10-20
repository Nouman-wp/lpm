import type { ReactNode } from "react";
import { CheckIcon, ClockIcon, ServerIcon, TerminalIcon } from "./icons";
import { MACHINE } from "../machineWords";

type PointKind = "pro" | "time" | "plain";

interface Mode {
  key: string;
  icon: ReactNode;
  color: string;
  label: string;
  recommended?: boolean;
  points: { kind: PointKind; text: string }[];
  onClick: () => void;
}

const POINT_MARK: Record<PointKind, ReactNode> = {
  pro: (
    <span className="text-[var(--accent-green)]">
      <CheckIcon />
    </span>
  ),
  time: (
    <span className="text-[var(--text-muted)]">
      <ClockIcon size={12} />
    </span>
  ),
  plain: <span className="h-px w-2.5 bg-[var(--text-muted)]" />,
};

// A server can run lpm itself (paired like a Linux host in Settings →
// Connections) or be reached for one folder at a time over SSH from here.
export function ServerModeScreen({ onInstall, onSsh }: { onInstall: () => void; onSsh: () => void }) {
  const modes: Mode[] = [
    {
      key: "install",
      icon: <ServerIcon />,
      color: "var(--accent-cyan)",
      label: "Install lpm there",
      recommended: true,
      points: [
        { kind: "pro", text: `Work keeps running when ${MACHINE.thisMachine} sleeps` },
        { kind: "pro", text: "Every project on it shows in your sidebar" },
        { kind: "time", text: "First setup takes a few minutes" },
      ],
      onClick: onInstall,
    },
    {
      key: "ssh",
      icon: <TerminalIcon />,
      color: "var(--accent-blue)",
      label: "Just SSH in",
      points: [
        { kind: "pro", text: "Nothing is installed on the server" },
        { kind: "plain", text: `One folder per project, run from ${MACHINE.thisMachine}` },
      ],
      onClick: onSsh,
    },
  ];

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1.5">
      <p className="text-[12px] text-[var(--text-secondary)]">How should lpm work with it?</p>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={m.onClick}
          className="group flex items-start gap-3 rounded-xl border border-[var(--border)] p-3.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-hover)] transition-colors group-hover:bg-[var(--bg-active)] [&_svg]:h-5 [&_svg]:w-5"
            style={{ color: m.color }}
          >
            {m.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{m.label}</span>
              {m.recommended && (
                <span className="rounded-full bg-[var(--accent-green)]/10 px-1.5 text-[10px] font-medium leading-4 text-[var(--accent-green)]">
                  Recommended
                </span>
              )}
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {m.points.map((p) => (
                <li key={p.text} className="flex items-center gap-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="flex w-3 shrink-0 items-center justify-center">{POINT_MARK[p.kind]}</span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
        </button>
      ))}
    </div>
  );
}
