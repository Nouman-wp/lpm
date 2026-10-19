import { useEffect, useRef, useState } from "react";
import { EventsOn } from "../../../bridge/runtime";
import { PeerShareJoin, PeerShareJoinCancel, TakeShareJoinLink } from "../../../bridge/commands";
import { Modal } from "../ui/Modal";
import { decodeShareInvite, shareLink } from "../../share/invite";
import { refreshJoinedTabs, useTabShares } from "../../store/tabShares";
import { useAppStore } from "../../store/app";

// Paste a shared tab's invite and wait for its host to let this machine in.
export function JoinSharedTabDialog() {
  const dialog = useTabShares((s) => s.joinDialog);
  const close = useTabShares((s) => s.closeJoinDialog);
  const openJoinDialog = useTabShares((s) => s.openJoinDialog);
  const setOpenTab = useTabShares((s) => s.setOpenTab);
  const setView = useAppStore((s) => s.setView);
  const [value, setValue] = useState("");
  const [waitingOn, setWaitingOn] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    if (!dialog) return;
    setValue(dialog.invite);
    setWaitingOn(null);
    setJoining(false);
    setError(null);
  }, [dialog]);

  // A link from lpm.cx's join page that opened lpm, or reached it running.
  useEffect(() => {
    const take = () =>
      void TakeShareJoinLink()
        .then((invite) => {
          if (invite) openJoinDialog(shareLink(invite));
        })
        .catch(() => {});
    take();
    const off = EventsOn("share-join-link", take);
    return () => {
      if (typeof off === "function") off();
    };
  }, [openJoinDialog]);

  useEffect(
    () =>
      EventsOn("peer-share-join-pending", (p: { hostName?: string }) => {
        setWaitingOn(p?.hostName || "the host");
      }),
    [],
  );

  if (!dialog) return null;

  const invite = decodeShareInvite(value);
  const invalid = value.trim().length > 0 && !invite;

  const join = async () => {
    if (!invite || joining) return;
    const mine = ++attempt.current;
    setJoining(true);
    setError(null);
    try {
      const { slug } = (await PeerShareJoin(invite.hosts, invite.port, invite.secret, invite.fp)) as {
        slug: string;
      };
      if (mine !== attempt.current) return;
      await refreshJoinedTabs();
      setOpenTab(slug);
      setView("shared");
      close();
    } catch (err) {
      if (mine !== attempt.current) return;
      const msg = String(err);
      if (msg !== "cancelled") setError(msg);
      setJoining(false);
      setWaitingOn(null);
    }
  };

  const cancel = () => {
    attempt.current++;
    if (joining) void PeerShareJoinCancel();
    close();
  };

  return (
    <Modal
      open
      onClose={cancel}
      contentClassName="w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl"
    >
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Join a shared tab</h2>
      {waitingOn ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--accent-cyan)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Waiting for {waitingOn} to let you in…
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {dialog.invite
              ? "Someone shared a tab with you. Join, and they let you in from their machine."
              : "Paste the link you were sent. The person sharing the tab lets you in from their machine."}
          </p>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void join();
              }
            }}
            placeholder="https://lpm.cx/join#…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={joining}
            className={`mt-4 w-full rounded-lg border bg-[var(--bg-primary)] px-3 py-1.5 font-mono text-[12px] text-[var(--text-primary)] outline-none transition-colors ${
              invite
                ? "border-[var(--accent-cyan)]"
                : invalid
                  ? "border-[color-mix(in_srgb,var(--accent-red)_45%,var(--border))]"
                  : "border-[var(--border)] focus:border-[var(--accent-cyan)]"
            }`}
          />
          {invalid && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              That isn't a complete shared-tab link. Paste the whole thing.
            </p>
          )}
        </>
      )}
      {error && <p className="mt-3 text-xs text-[var(--accent-red)]">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
        {!waitingOn && (
          <button
            type="button"
            onClick={() => void join()}
            disabled={!invite || joining}
            className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {joining ? "Connecting…" : "Join"}
          </button>
        )}
      </div>
    </Modal>
  );
}
