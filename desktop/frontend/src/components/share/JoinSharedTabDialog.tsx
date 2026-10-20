import { useEffect, useRef, useState } from "react";
import { EventsOn } from "../../../bridge/runtime";
import {
  PeerShareJoin,
  PeerShareJoinCancel,
  ReadClipboardText,
  TakeShareJoinLink,
} from "../../../bridge/commands";
import { Modal } from "../ui/Modal";
import { JoinInviteOffer } from "./JoinInviteOffer";
import { JoinSteps } from "./JoinSteps";
import { JoinFailureNotice } from "./JoinFailureNotice";
import { decodeShareInvite, shareLink, type ShareInvite } from "../../share/invite";
import { joinFailure, type JoinFailure } from "../../share/joinFailure";
import { refreshJoinedTabs, useTabShares } from "../../store/tabShares";
import { useAppStore } from "../../store/app";

interface Offer {
  link: string;
  invite: ShareInvite;
  fromClipboard: boolean;
}

function offerOf(text: string, fromClipboard: boolean): Offer | null {
  const invite = decodeShareInvite(text);
  return invite ? { link: shareLink(text), invite, fromClipboard } : null;
}

type Phase =
  | { at: "pick" }
  | { at: "joining"; reached: boolean; host: string; label: string; code: string }
  | { at: "failed"; failure: JoinFailure; invite: ShareInvite };

const BUTTON =
  "rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";
const PRIMARY =
  "rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50";

// Join a tab someone shared: the link from lpm.cx, or one on the clipboard, is
// offered first. Then it waits for the host to let this machine in, with the
// four emoji they see too, and says plainly what happened if it doesn't work.
export function JoinSharedTabDialog() {
  const dialog = useTabShares((s) => s.joinDialog);
  const close = useTabShares((s) => s.closeJoinDialog);
  const openJoinDialog = useTabShares((s) => s.openJoinDialog);
  const setOpenTab = useTabShares((s) => s.setOpenTab);
  const setView = useAppStore((s) => s.setView);
  const [value, setValue] = useState("");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [phase, setPhase] = useState<Phase>({ at: "pick" });
  const attempt = useRef(0);

  useEffect(() => {
    if (!dialog) return;
    setValue("");
    setPhase({ at: "pick" });
    if (dialog.invite) {
      setOffer(offerOf(dialog.invite, false));
      return;
    }
    setOffer(null);
    let live = true;
    void ReadClipboardText()
      .then((text: string) => {
        const found = offerOf(text.trim(), true);
        if (live && found) setOffer(found);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
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
      EventsOn("peer-share-join-pending", (p: { hostName?: string; label?: string; code?: string }) => {
        setPhase((ph) =>
          ph.at === "joining"
            ? {
                at: "joining",
                reached: true,
                host: p?.hostName || ph.host,
                label: p?.label || ph.label,
                code: p?.code || "",
              }
            : ph,
        );
      }),
    [],
  );

  if (!dialog) return null;

  const pasted = decodeShareInvite(value);
  const invalid = value.trim().length > 0 && !pasted;

  const join = async (invite: ShareInvite) => {
    const mine = ++attempt.current;
    setPhase({ at: "joining", reached: false, host: invite.hostName, label: invite.label, code: "" });
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
      if (msg === "cancelled") return;
      setPhase((ph) => ({
        at: "failed",
        failure: joinFailure(msg, ph.at === "joining" ? ph.host : invite.hostName),
        invite,
      }));
    }
  };

  const cancel = () => {
    attempt.current++;
    if (phase.at === "joining") void PeerShareJoinCancel();
    close();
  };

  const title =
    phase.at === "joining" ? `Joining ${phase.label || "a shared tab"}` : "Join a shared tab";

  return (
    <Modal
      open
      onClose={cancel}
      contentClassName="w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl"
    >
      <h2 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h2>

      {phase.at === "pick" && (
        <>
          {offer ? (
            <div className="mt-4">
              <JoinInviteOffer
                link={offer.link}
                invite={offer.invite}
                fromClipboard={offer.fromClipboard}
                onJoin={() => void join(offer.invite)}
              />
              <div className="mb-2 mt-4 flex items-center gap-2.5 text-[11px] text-[var(--text-muted)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                or paste another link
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Paste the link you were sent. The person sharing the tab lets you in from their
              machine.
            </p>
          )}
          <input
            autoFocus={!offer}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pasted) {
                e.preventDefault();
                void join(pasted);
              }
            }}
            placeholder="https://lpm.cx/join#…"
            aria-label="Invite link"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className={`w-full rounded-lg border bg-[var(--bg-primary)] px-3 py-1.5 font-mono text-[12px] text-[var(--text-primary)] outline-none transition-colors ${
              offer ? "" : "mt-4"
            } ${
              pasted
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

      {phase.at === "joining" && (
        <>
          <div className="mt-[18px]">
            <JoinSteps reached={phase.reached} host={phase.host} label={phase.label} />
          </div>
          {phase.code && (
            <div className="mt-[18px] rounded-xl bg-[var(--bg-secondary)] p-3.5 text-center">
              <div className="text-[28px] leading-none tracking-[0.12em]">{phase.code}</div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {phase.host || "They"} sees these four too. Read them out if asked.
              </p>
            </div>
          )}
        </>
      )}

      {phase.at === "failed" && <JoinFailureNotice failure={phase.failure} />}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={cancel} className={BUTTON}>
          {phase.at === "failed" ? "Close" : "Cancel"}
        </button>
        {phase.at === "pick" && (
          <button
            type="button"
            onClick={() => pasted && void join(pasted)}
            disabled={!pasted}
            className={PRIMARY}
          >
            Join
          </button>
        )}
        {phase.at === "failed" && phase.failure.retry && (
          <button type="button" onClick={() => void join(phase.invite)} className={PRIMARY}>
            {phase.failure.retry}
          </button>
        )}
      </div>
    </Modal>
  );
}
