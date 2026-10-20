import { useEffect, useRef, useState } from "react";
import { ShareKnockCard } from "./ShareKnockCard";
import { ShareAskCard } from "./ShareAskCard";
import { ShareKnockNote, type KnockNote } from "./ShareKnockNote";
import { PersonAvatar } from "./PersonAvatar";
import {
  useTabShares,
  watchTabShares,
  type HostedShare,
  type ShareGuest,
  type ShareWaiting,
} from "../../store/tabShares";
import { declineAsk, respondToJoin, setGuestCanType } from "../../share/shareCalls";

// A Deny waits this long for Undo before the asker is turned away.
const UNDO_MS = 5000;
const SHOWN_BEHIND = 3;

type Knock =
  | { kind: "join"; id: string; share: HostedShare; waiting: ShareWaiting }
  | { kind: "ask"; id: string; share: HostedShare; guest: ShareGuest };

function knocksOf(hosted: HostedShare[]): Knock[] {
  return hosted.flatMap((share) => [
    ...share.waiting.map((waiting): Knock => ({ kind: "join", id: waiting.id, share, waiting })),
    ...share.guests
      .filter((g) => g.asked)
      .map((guest): Knock => ({ kind: "ask", id: `ask:${guest.id}`, share, guest })),
  ]);
}

// People asking to join a shared tab, or to type in one, as cards in the
// corner. They never take the keyboard from what you're typing, and closing
// one leaves the person waiting in the Share list rather than turning them away.
export function ShareKnocks() {
  const hosted = useTabShares((s) => s.hosted);
  // That share's popover lists the same people, with the same buttons.
  const inPopover = useTabShares((s) => s.shareDialog?.terminalId);
  const [later, setLater] = useState<string[]>([]);
  const [denying, setDenying] = useState<string[]>([]);
  const [note, setNote] = useState<KnockNote | null>(null);
  const noteTimer = useRef(0);
  const denyTimers = useRef(new Map<string, number>());

  useEffect(() => watchTabShares(), []);

  const all = knocksOf(hosted);
  const allIds = all.map((k) => k.id).join(" ");
  // An ask closed for later shows again the next time that person asks.
  useEffect(() => {
    const live = new Set(allIds.split(" "));
    setLater((ids) => (ids.every((id) => live.has(id)) ? ids : ids.filter((id) => live.has(id))));
  }, [allIds]);

  useEffect(
    () => () => {
      window.clearTimeout(noteTimer.current);
      denyTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const show = (next: KnockNote) => {
    window.clearTimeout(noteTimer.current);
    setNote(next);
    noteTimer.current = window.setTimeout(() => setNote(null), UNDO_MS);
  };

  const apply = (call: Promise<void>) => {
    void call.catch(() => {});
  };

  const deny = (k: Extract<Knock, { kind: "join" }>) => {
    setDenying((ids) => [...ids, k.id]);
    const settle = () => {
      denyTimers.current.delete(k.id);
      setDenying((ids) => ids.filter((id) => id !== k.id));
    };
    denyTimers.current.set(
      k.id,
      window.setTimeout(() => {
        settle();
        apply(respondToJoin(k.share, k.id, false));
      }, UNDO_MS),
    );
    show({
      text: `${k.waiting.name} won't be let in`,
      tone: "out",
      undo: () => {
        window.clearTimeout(denyTimers.current.get(k.id));
        settle();
        setNote(null);
      },
    });
  };

  const letIn = (k: Extract<Knock, { kind: "join" }>, canType?: boolean) => {
    apply(respondToJoin(k.share, k.id, true, canType));
    const types = canType ?? k.share.canType;
    show({
      text: types ? `${k.waiting.name} is in and can type` : `${k.waiting.name} is watching`,
      tone: types ? "type" : "watch",
    });
  };

  const allowTyping = (k: Extract<Knock, { kind: "ask" }>) => {
    apply(setGuestCanType(k.share, k.guest.id, true));
    show({
      text: `${k.guest.name} can type now`,
      tone: "type",
      undo: () => {
        apply(setGuestCanType(k.share, k.guest.id, false));
        setNote(null);
      },
    });
  };

  const shown = all.filter(
    (k) =>
      !later.includes(k.id) && !denying.includes(k.id) && k.share.terminalId !== inPopover,
  );
  if (shown.length === 0 && !note) return null;
  const [first, ...behind] = shown;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-32 right-4 z-[60] flex w-[352px] flex-col gap-2"
    >
      {note && <ShareKnockNote note={note} />}
      {first?.kind === "join" && (
        <ShareKnockCard
          waiting={first.waiting}
          label={first.share.label}
          more={behind.length}
          onDeny={() => deny(first)}
          onLetIn={(canType) => letIn(first, canType)}
          onLater={() => setLater((ids) => [...ids, first.id])}
        />
      )}
      {first?.kind === "ask" && (
        <ShareAskCard
          guest={first.guest}
          label={first.share.label}
          onAllow={() => allowTyping(first)}
          onNotNow={() => apply(declineAsk(first.share, first.guest.id))}
          onLater={() => setLater((ids) => [...ids, first.id])}
        />
      )}
      {behind.slice(0, SHOWN_BEHIND).map((k) => {
        const name = k.kind === "join" ? k.waiting.name : k.guest.name;
        return (
          <div
            key={k.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-secondary)] shadow-lg"
          >
            <PersonAvatar name={name} size={22} />
            <span className="min-w-0 flex-1 truncate">
              {k.kind === "join" ? `${name} is waiting to join ${k.share.label}` : `${name} asks to type`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
