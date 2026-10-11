import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

// One numbered step of a connect flow: a check once it's done, highlighted while
// it's the one to do, and its controls underneath.
export function SetupStep({
  n,
  title,
  done,
  current,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  current: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          done
            ? "bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan-text)] [&_svg]:h-3 [&_svg]:w-3"
            : current
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
        }`}
      >
        {done ? <CheckIcon /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p
          className={`text-[13px] font-medium ${current || done ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
        >
          {title}
        </p>
        {children}
      </div>
    </li>
  );
}
