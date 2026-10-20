import { PersonAvatar } from "./PersonAvatar";
import type { ShareWaiting } from "../../store/tabShares";

export function ShareWaitingRow({
  waiting,
  onRespond,
}: {
  waiting: ShareWaiting;
  onRespond: (allow: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-[var(--accent-yellow)]/5 px-3 py-2.5">
      <PersonAvatar name={waiting.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {waiting.name}
          <span className="ml-1.5 text-[11px] font-normal text-[var(--text-muted)]">wants to join</span>
        </div>
        {waiting.code && (
          <div title="They see these emoji too" className="mt-0.5 text-sm tracking-wider">
            {waiting.code}
          </div>
        )}
      </div>
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
