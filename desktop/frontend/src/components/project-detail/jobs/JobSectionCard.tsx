import type { ReactNode } from "react";
import { ChevronDownIcon } from "../../icons";

const TONES = {
  green: "bg-[var(--accent-green)]/12 text-[var(--accent-green-text)]",
  cyan: "bg-[var(--accent-cyan)]/12 text-[var(--accent-cyan-text)]",
};

// One of the job editor's collapsible sections: a header recapping what's set
// and whether it's ready to save, the rows that edit it, and `after` (notes,
// previews) under the card while it's open. A problem replaces the recap.
export function JobSectionCard({
  icon,
  tone,
  title,
  summary,
  problem,
  open,
  onToggle,
  after,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  summary: string;
  problem: string | null;
  open: boolean;
  onToggle: () => void;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/40">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-hover)]/30"
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </span>
            <span
              className={`block truncate text-[12.5px] ${
                problem
                  ? "text-[var(--accent-amber-text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {problem ?? summary}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
              problem
                ? "bg-[var(--accent-amber)]/12 text-[var(--accent-amber-text)]"
                : "bg-[var(--accent-green)]/12 text-[var(--accent-green-text)]"
            }`}
          >
            {problem ? "Fix" : "Done"}
          </span>
          <span
            className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          >
            <ChevronDownIcon />
          </span>
        </button>
        {open && (
          <div className="divide-y divide-[var(--border)]/70 border-t border-[var(--border)]/70">
            {children}
          </div>
        )}
      </section>
      {open && after}
    </div>
  );
}
