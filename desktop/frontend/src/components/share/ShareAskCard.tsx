import { PersonAvatar } from "./PersonAvatar";
import { ShareCard } from "./ShareCard";
import { MACHINE as M } from "../../machineWords";
import { viaName, type ShareGuest } from "../../store/tabShares";

// A guest asking to type in a shared tab, answered for them alone.
export function ShareAskCard({
  guest,
  label,
  onAllow,
  onNotNow,
  onLater,
}: {
  guest: ShareGuest;
  label: string;
  onAllow: () => void;
  onNotNow: () => void;
  onLater: () => void;
}) {
  return (
    <ShareCard
      avatar={<PersonAvatar name={guest.name} size={32} dot={guest.connected ? "live" : "away"} />}
      title={`${guest.name} asks to type`}
      subtitle={`In ${label} · from ${viaName(guest.via)}`}
      laterHint="Answer later, from the Share list."
      onLater={onLater}
    >
      <p className="mt-2.5 text-[11px] leading-[1.45] text-[var(--text-muted)]">
        Only {guest.name} gets the keyboard. They could run commands on {M.thisMachine} from this
        tab, until you take it back.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onNotNow}
          className="h-8 rounded-lg border border-[var(--border)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onAllow}
          className="h-8 max-w-[200px] truncate rounded-lg bg-[var(--text-primary)] px-3 text-[13px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
        >
          Let {guest.name} type
        </button>
      </div>
    </ShareCard>
  );
}
