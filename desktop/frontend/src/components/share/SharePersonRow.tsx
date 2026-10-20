import { Globe, Keyboard, Laptop, X } from "lucide-react";
import { Switch } from "../ui/Switch";
import { Tooltip } from "../ui/Tooltip";
import { PersonAvatar } from "./PersonAvatar";
import { viaName, type ShareGuest } from "../../store/tabShares";

export function SharePersonRow({
  guest,
  typingNow,
  busy,
  onSetCanType,
  onDeclineAsk,
  onRemove,
}: {
  guest: ShareGuest;
  typingNow: boolean;
  busy: boolean;
  onSetCanType: (canType: boolean) => void;
  onDeclineAsk: () => void;
  onRemove: () => void;
}) {
  const Source = guest.via === "browser" ? Globe : Laptop;
  const status = !guest.connected ? "Away" : guest.canType ? "Can type" : "Watching";
  return (
    <div className={`px-3 py-2.5 ${guest.connected ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <PersonAvatar name={guest.name} dot={guest.connected ? "live" : "away"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <span className="truncate">{guest.name}</span>
            {typingNow && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-amber)]/15 px-1.5 py-px text-[10px] font-semibold text-[var(--accent-amber)]">
                <Keyboard size={10} strokeWidth={2.5} />
                Typing now
              </span>
            )}
          </div>
          <div className="mt-px flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Source size={11} className="shrink-0" />
            <span className="truncate">
              From {viaName(guest.via)} · {status}
            </span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={guest.canType}
          aria-label={`${guest.name} can type`}
          disabled={busy}
          onClick={() => onSetCanType(!guest.canType)}
          className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 text-[11px] text-[var(--text-muted)] disabled:opacity-50"
        >
          Can type
          <Switch checked={guest.canType} />
        </button>
        <Tooltip content={`Remove ${guest.name}`} side="bottom" align="end">
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${guest.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)] disabled:opacity-50"
          >
            <X size={13} />
          </button>
        </Tooltip>
      </div>
      {guest.asked && (
        <div className="mt-2 ml-10 flex items-center gap-2 rounded-lg bg-[var(--accent-cyan)]/10 py-1.5 pl-2.5 pr-1.5 text-xs text-[var(--text-primary)]">
          <span className="min-w-0 flex-1 truncate">Asks to type</span>
          <button
            type="button"
            onClick={onDeclineAsk}
            disabled={busy}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => onSetCanType(true)}
            disabled={busy}
            className="rounded-md bg-[var(--text-primary)] px-2.5 py-1 text-[11px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Let {guest.name} type
          </button>
        </div>
      )}
    </div>
  );
}
