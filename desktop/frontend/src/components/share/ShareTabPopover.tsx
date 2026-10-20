import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { SetClipboardText } from "../../../bridge/commands";
import { ShareLinkRow } from "./ShareLinkRow";
import { ShareQrCode } from "./ShareQrCode";
import { ShareAccessPicker } from "./ShareAccessPicker";
import { SharePeople } from "./SharePeople";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useEventListener } from "../../hooks/useEventListener";
import { useTabShares, watchTabShares, type ShareTarget } from "../../store/tabShares";
import { setShareCanType, startShare, stopShare } from "../../share/shareCalls";
import { peerSlugOf } from "../../peer/markers";
import { useAppStore } from "../../store/app";
import { displayNameForProjectName } from "../ProjectNameDisplay";
import { GLOBAL_TERMINALS_KEY } from "../../terminals";
import { shareLink } from "../../share/invite";
import { placeSharePopover } from "../../share/popoverPlace";
import { MACHINE as M } from "../../machineWords";

const WIDTH = 400;
const COPIED_FOR_MS = 2400;

function projectOf(target: ShareTarget): string {
  return target.project === GLOBAL_TERMINALS_KEY
    ? ""
    : displayNameForProjectName(target.project, useAppStore.getState().projects);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Share one tab: opening it makes the link and puts it on the clipboard, so
// sending it is the next step. People ask to join through it and are let in by
// hand (ShareKnocks); this lists them, with what each may do.
export function ShareTabPopover() {
  const target = useTabShares((s) => s.shareDialog);
  const close = useTabShares((s) => s.closeShareDialog);
  const share = useTabShares((s) =>
    target ? s.hosted.find((h) => h.terminalId === target.terminalId) : undefined,
  );
  // The paired machine the tab runs on, which shares it.
  const machine = peerSlugOf(target?.terminalId);
  const machineName = useTabShares((s) => (machine ? s.machineNames[machine] : undefined));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const copiedTimer = useRef(0);
  const panelRef = useOutsideClick<HTMLDivElement>((event) => {
    // The Share button toggles the popover itself.
    if ((event.target as Element | null)?.closest?.("[data-share-button]")) return;
    close();
  }, !!target);

  useEffect(() => watchTabShares(), []);

  const copy = (invite: string) => {
    void SetClipboardText(shareLink(invite)).then(() => {
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
    });
  };

  useEffect(() => {
    if (!target) return;
    setError(null);
    setQrOpen(false);
    setCopied(false);
    if (useTabShares.getState().hosted.some((h) => h.terminalId === target.terminalId)) return;
    let live = true;
    setBusy(true);
    startShare(target, projectOf(target))
      .then((made) => {
        if (live && made) copy(made.invite);
      })
      .catch((err) => {
        if (live) setError(errorText(err));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [target]);

  // The terminal keeps focus under the popover, and Escape there would reach
  // the agent: closing the popover takes it first.
  useEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
    },
    window,
    !!target,
    true,
  );

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  if (!target) return null;

  const run = async (call: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await call();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!share) return close();
    await run(() => stopShare(share));
    close();
  };

  const project = projectOf(target);
  const from = machine ? (machineName ?? M.anotherMachine) : M.thisMachine;
  const place = placeSharePopover(target.anchor, WIDTH, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const link = share ? shareLink(share.invite) : "";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Share ${target.label}`}
      style={{ left: place.left, top: place.top, maxHeight: place.maxHeight, width: WIDTH }}
      className="fixed z-[55] flex flex-col overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
              Share {target.label}
            </h2>
            <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {project ? `${project} · from ${from}` : `From ${from}`}
            </div>
          </div>
          {share ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-cyan)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-cyan)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-cyan)]" />
              Link ready
            </span>
          ) : (
            !error && (
              <span className="shrink-0 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                Making the link…
              </span>
            )
          )}
        </div>

        {share && (
          <>
            <div className="mt-3.5">
              <ShareLinkRow
                link={link}
                copied={copied}
                qrOpen={qrOpen}
                onCopy={() => copy(share.invite)}
                onToggleQr={share.browser ? () => setQrOpen((o) => !o) : undefined}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {copied
                ? share.browser
                  ? "On your clipboard. It opens in lpm, or in any browser."
                  : "On your clipboard. It opens in lpm on their computer."
                : share.browser
                  ? "Opens in lpm, or in any browser with nothing to install."
                  : "Opens in lpm on their computer, or under Add → Join a shared tab."}
            </p>
            {qrOpen && (
              <div className="mt-3">
                <ShareQrCode link={link} />
              </div>
            )}
            <div className="mt-4">
              <ShareAccessPicker
                canType={share.canType}
                disabled={busy}
                onChange={(canType) => void run(() => setShareCanType(share, canType))}
              />
            </div>
            <div className="mt-4">
              <SharePeople share={share} busy={busy} run={(call) => void run(call)} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <ArrowDown size={13} className="shrink-0" />
              They see what happens from now on, not what's above.
            </div>
          </>
        )}

        {error && <p className="mt-3 text-xs text-[var(--accent-red)]">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-2.5">
        {share ? (
          <button
            type="button"
            onClick={() => void stop()}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Stop sharing
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
