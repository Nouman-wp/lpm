import { Check } from "lucide-react";

type StepState = "done" | "now" | "next";

// One step of JoinSteps, with the line down to the next unless it is the last.
export function JoinStep({ state, last, children }: { state: StepState; last?: boolean; children: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {state === "done" ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--accent-green)]/15 text-[var(--accent-green)]">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : state === "now" ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full ring-2 ring-inset ring-[var(--accent-cyan)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-cyan)]" />
          </span>
        ) : (
          <span className="h-[22px] w-[22px] rounded-full ring-2 ring-inset ring-[var(--border)]" />
        )}
        {!last && <span className="h-[18px] w-0.5 bg-[var(--border)]" />}
      </div>
      <div
        className={`pt-0.5 text-[13px] ${
          state === "now"
            ? "font-semibold text-[var(--text-primary)]"
            : state === "done"
              ? "text-[var(--text-secondary)]"
              : "text-[var(--text-muted)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
