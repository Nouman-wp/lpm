import { CircleSlash, Link2Off, TriangleAlert, WifiOff } from "lucide-react";
import type { JoinFailure } from "../../share/joinFailure";

const ICONS = {
  offline: WifiOff,
  refused: CircleSlash,
  ended: Link2Off,
  other: TriangleAlert,
} as const;

export function JoinFailureNotice({ failure }: { failure: JoinFailure }) {
  const Icon = ICONS[failure.kind];
  return (
    <div className="mt-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-amber)]/12 text-[var(--accent-amber)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">{failure.title}</div>
        <p className="mt-1 text-[13px] leading-normal text-[var(--text-secondary)]">{failure.text}</p>
        {failure.detail && (
          <p className="mt-1.5 break-words font-mono text-[11px] text-[var(--text-muted)]">{failure.detail}</p>
        )}
      </div>
    </div>
  );
}
