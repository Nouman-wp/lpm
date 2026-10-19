import type { ShareWaiting } from "../../store/tabShares";

export function ShareWaitingRow({
  waiting,
  onRespond,
}: {
  waiting: ShareWaiting;
  onRespond: (allow: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--accent-yellow)]" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">
        {waiting.name}
        <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">wants to join</span>
      </span>
      {waiting.code && (
        <span
          title="They see these emoji too"
          className="shrink-0 rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-xs"
        >
          {waiting.code}
        </span>
      )}
      <button
        type="button"
        onClick={() => onRespond(false)}
        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        Deny
      </button>
      <button
        type="button"
        onClick={() => onRespond(true)}
        className="shrink-0 rounded-md bg-[var(--text-primary)] px-2.5 py-1 text-[11px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90"
      >
        Let in
      </button>
    </div>
  );
}
