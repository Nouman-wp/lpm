import { Users } from "lucide-react";
import {
  PeerShareDeclineAsk,
  PeerShareRemoveGuest,
  PeerShareRespond,
  PeerShareSetGuestCanType,
  PeerShareTakeKeyboards,
} from "../../../bridge/commands";
import { useNow } from "../../hooks/useNow";
import { SharePersonRow } from "./SharePersonRow";
import { ShareWaitingRow } from "./ShareWaitingRow";
import { anyoneTypes, type HostedShare, type ShareGuest } from "../../store/tabShares";

// "Typing now" holds this long past the last keys the host heard about.
const TYPING_NOW_MS = 5000;

function typingAt(g: ShareGuest, now: number): boolean {
  return g.connected && g.typedAt > 0 && now - g.typedAt < TYPING_NOW_MS;
}

export function SharePeople({
  share,
  busy,
  run,
}: {
  share: HostedShare;
  busy: boolean;
  run: (call: () => Promise<HostedShare[]>) => void;
}) {
  const now = useNow(share.guests.some((g) => typingAt(g, Date.now())), 1000);

  if (share.waiting.length === 0 && share.guests.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[var(--border)] p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
          <Users size={15} />
        </span>
        <p className="text-xs leading-[1.45] text-[var(--text-secondary)]">
          No one yet. When someone opens the link, you'll be asked before they get in.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          People
        </span>
        {anyoneTypes(share) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => PeerShareTakeKeyboards(share.id))}
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-amber)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Take every keyboard back
          </button>
        )}
      </div>
      <div className="mt-2 divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border border-[var(--border)]">
        {share.waiting.map((w) => (
          <ShareWaitingRow
            key={w.id}
            waiting={w}
            onRespond={(allow) => run(() => PeerShareRespond(w.id, allow))}
          />
        ))}
        {share.guests.map((g) => (
          <SharePersonRow
            key={g.id}
            guest={g}
            busy={busy}
            typingNow={typingAt(g, now)}
            onSetCanType={(canType) => run(() => PeerShareSetGuestCanType(share.id, g.id, canType))}
            onDeclineAsk={() => run(() => PeerShareDeclineAsk(share.id, g.id))}
            onRemove={() => run(() => PeerShareRemoveGuest(share.id, g.id))}
          />
        ))}
      </div>
    </div>
  );
}
