import type { ReactNode } from "react";

interface LauncherRowProps {
  label: string;
  leading: ReactNode;
  // A second line: what the typed text becomes here.
  sub?: string;
  // The second line is a command, shown as one.
  mono?: boolean;
  active: boolean;
  trailing?: ReactNode;
  onPoint: () => void;
  onChoose: () => void;
}

// One place the + popup opens; ↵ opens the one the cursor rests on.
export function LauncherRow({ label, leading, sub, mono, active, trailing, onPoint, onChoose }: LauncherRowProps) {
  return (
    <div
      onPointerMove={onPoint}
      className={`flex items-center gap-1.5 rounded-lg pr-1.5 transition-colors duration-75 ${
        active ? "bg-[var(--bg-hover)]" : ""
      }`}
    >
      <button
        type="button"
        aria-current={active || undefined}
        onClick={onChoose}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[7px] text-left"
      >
        <span
          aria-hidden
          className="grid h-4 w-4 shrink-0 place-items-center text-[var(--text-secondary)] [&>svg]:h-[15px] [&>svg]:w-[15px]"
        >
          {leading}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-[var(--text-primary)]">{label}</span>
          {sub && (
            <span
              className={`mt-px block truncate ${
                mono
                  ? "font-mono text-[11px] text-[var(--text-secondary)]"
                  : "text-[11.5px] text-[var(--text-muted)]"
              }`}
            >
              {sub}
            </span>
          )}
        </span>
      </button>
      {trailing}
      {active && (
        <kbd
          aria-hidden
          className="grid h-5 min-w-5 shrink-0 place-items-center rounded border border-[var(--border)] px-1 font-sans text-[11px] text-[var(--text-secondary)]"
        >
          ↵
        </kbd>
      )}
    </div>
  );
}
