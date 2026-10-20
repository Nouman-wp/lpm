import type { ReactNode } from "react";
import { X } from "lucide-react";

// A question from someone in a share, as ShareKnocks stacks it: who, what they
// want, and X to answer it later from the Share list.
export function ShareCard({
  avatar,
  title,
  subtitle,
  laterHint,
  onLater,
  children,
}: {
  avatar: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  laterHint: string;
  onLater: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-auto rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] p-3.5 shadow-2xl">
      <div className="flex items-center gap-2.5">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="mt-px truncate text-xs text-[var(--text-muted)]">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onLater}
          aria-label="Answer later"
          title={laterHint}
          className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <X size={13} />
        </button>
      </div>
      {children}
    </div>
  );
}
