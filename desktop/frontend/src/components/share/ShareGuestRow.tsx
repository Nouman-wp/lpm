import type { ShareGuest } from "../../store/tabShares";

export function ShareGuestRow({
  guest,
  busy,
  onRemove,
}: {
  guest: ShareGuest;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          guest.connected ? "bg-[var(--accent-green)]" : "bg-[var(--text-muted)]/50"
        }`}
        title={guest.connected ? "Watching now" : "Not connected"}
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">
        {guest.name}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
        {guest.connected ? "Watching" : "Away"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
