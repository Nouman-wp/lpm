import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  PeerShareRemoveGuest,
  PeerShareRespond,
  PeerShareSetCanType,
  PeerShareStart,
  PeerShareStop,
} from "../../../bridge/commands";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ShareGuestRow } from "./ShareGuestRow";
import { ShareWaitingRow } from "./ShareWaitingRow";
import { useTabShares, watchTabShares, type HostedShare } from "../../store/tabShares";
import { useAppStore } from "../../store/app";
import { displayNameForProjectName } from "../ProjectNameDisplay";
import { GLOBAL_TERMINALS_KEY } from "../../terminals";
import { shareLink } from "../../share/invite";

type Access = "view" | "type";

const ACCESS_OPTIONS = [
  { value: "view", label: "View only" },
  { value: "type", label: "Can type" },
] as const;

// Share one tab with someone who has lpm. They see it live at this tab's size;
// each person is let in by hand, and typing is off until it's switched on here.
export function ShareTabDialog() {
  const target = useTabShares((s) => s.shareDialog);
  const close = useTabShares((s) => s.closeShareDialog);
  const setHosted = useTabShares((s) => s.setHosted);
  const share = useTabShares((s) =>
    target ? s.hosted.find((h) => h.terminalId === target.terminalId) : undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => watchTabShares(), []);
  useEffect(() => {
    setError(null);
    setCopied(false);
  }, [target?.terminalId]);

  if (!target) return null;

  const run = async (call: () => Promise<HostedShare[]>) => {
    setBusy(true);
    setError(null);
    try {
      setHosted(await call());
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = () => {
    if (!share) return;
    void navigator.clipboard.writeText(shareLink(share.invite)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <Modal
      open
      onClose={close}
      contentClassName="w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
          <Users size={16} />
        </span>
        <h2 className="min-w-0 truncate text-base font-semibold text-[var(--text-primary)]">
          Share “{target.label}”
        </h2>
      </div>

      {!share ? (
        <>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Someone with lpm can follow this tab live. You let each person in
            yourself, and they can only watch until you let them type.
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            They need to reach this machine, on the same network or tailnet.
          </p>
        </>
      ) : (
        <>
          <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Invite link
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={shareLink(share.invite)}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 font-mono text-[12px] text-[var(--text-secondary)] outline-none"
            />
            <button
              type="button"
              onClick={copyInvite}
              className="shrink-0 rounded-lg bg-[var(--accent-cyan)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            Send it to the person you're sharing with. Opening it brings up lpm
            on their computer, or they can paste it under Add → Join a shared tab.
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--text-primary)]">Guests</span>
            <SegmentedControl<Access>
              value={share.canType ? "type" : "view"}
              options={ACCESS_OPTIONS}
              onChange={(v) => void run(() => PeerShareSetCanType(share.id, v === "type"))}
              ariaLabel="What guests can do"
            />
          </div>
          {share.canType && (
            <p className="mt-2 text-xs text-[var(--accent-amber)]">
              Anyone you let in can run commands on this machine from this tab.
            </p>
          )}

          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {share.waiting.map((w) => (
              <ShareWaitingRow
                key={w.id}
                waiting={w}
                onRespond={(allow) => void run(() => PeerShareRespond(w.id, allow))}
              />
            ))}
            {share.guests.map((g) => (
              <ShareGuestRow
                key={g.id}
                guest={g}
                busy={busy}
                onRemove={() => void run(() => PeerShareRemoveGuest(share.id, g.id))}
              />
            ))}
            {share.waiting.length === 0 && share.guests.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-[var(--text-muted)]">
                No one has joined yet.
              </p>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-[var(--accent-red)]">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-2">
        {share ? (
          <button
            type="button"
            onClick={() => void run(() => PeerShareStop(share.id))}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Stop sharing
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {share ? "Done" : "Cancel"}
          </button>
          {!share && (
            <button
              type="button"
              onClick={() => {
                const project =
                  target.project === GLOBAL_TERMINALS_KEY
                    ? ""
                    : displayNameForProjectName(target.project, useAppStore.getState().projects);
                void run(() => PeerShareStart(target.terminalId, project, target.label));
              }}
              disabled={busy}
              className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create invite"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
