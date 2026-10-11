import type { ReactNode } from "react";
import { ZapIcon } from "../../icons";
import type { JobRunKind } from "../../../jobsFormat";

const stroke = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SparkIcon() {
  return (
    <svg {...stroke}>
      <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg {...stroke}>
      <path d="m4 7 5 5-5 5" />
      <path d="M12 18h8" />
    </svg>
  );
}

const KINDS: { value: JobRunKind; title: string; hint: string; icon: ReactNode }[] = [
  { value: "prompt", title: "AI prompt", hint: "An agent follows instructions", icon: <SparkIcon /> },
  { value: "cmd", title: "Command", hint: "One shell line", icon: <PromptIcon /> },
  { value: "action", title: "Action", hint: "From the project config", icon: <ZapIcon /> },
];

// What the job does when it runs, as three tiles above the box that edits it.
// An action belongs to one project's config, so it needs exactly one project.
export function RunKindPicker({
  value,
  onChange,
  actionsAvailable,
}: {
  value: JobRunKind;
  onChange: (kind: JobRunKind) => void;
  actionsAvailable: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="What it does"
      className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/20 p-1"
    >
      {KINDS.map((kind) => {
        const on = kind.value === value;
        const disabled = kind.value === "action" && !actionsAvailable;
        return (
          <button
            key={kind.value}
            type="button"
            onClick={() => onChange(kind.value)}
            disabled={disabled}
            aria-pressed={on}
            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${
              on
                ? "border-[var(--border)] bg-[var(--bg-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                : "border-transparent hover:bg-[var(--bg-hover)] disabled:hover:bg-transparent"
            }`}
          >
            <span
              className={`flex items-center gap-2 text-[13px] font-semibold ${
                on ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {kind.icon}
              {kind.title}
            </span>
            <span className="w-full truncate text-[11.5px] text-[var(--text-muted)]">
              {disabled ? "Needs exactly one project" : kind.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
