"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { ShareAccessPicker } from "./share-access-picker";
import { ShareLinkRow } from "./share-link-row";
import { SharePeople } from "./share-people";
import { ShareQrCode } from "./share-qr-code";
import { FOCUS_RING } from "./ui";
import { shareLink, shortShareLink, type TabShares } from "./use-tab-shares";

const WIDTH = 400;
const GAP = 6;
const MARGIN = 8;
const COPIED_FOR_MS = 2400;

// Ports the app's ShareTabPopover: share one tab, then let people in by hand.
// It opens under the Share button, or at the point a tab's menu was opened.
// Keyed by the tab it shares, so another tab's opens fresh.
export function ShareTabPopover({ shares, project }: { shares: TabShares; project: string }) {
  const { target, close } = shares;
  const share = target ? shares.shares[target.key] : undefined;
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const copiedTimer = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const targetKey = target?.key;

  useEffect(() => {
    if (!targetKey) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (panelRef.current?.contains(el) || el?.closest?.("[data-share-button]")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [targetKey, close]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  if (!target) return null;

  const copy = (link: string) => {
    void navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
  };

  const { anchor, bounds } = target;
  const point = anchor.right - anchor.left < 1;
  const preferred = point ? anchor.left : anchor.right - WIDTH;
  const left = Math.max(MARGIN, Math.min(preferred, bounds.width - WIDTH - MARGIN));
  const top = anchor.bottom + GAP;
  const ready = share?.ready ? share : undefined;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Share ${target.label}`}
      style={{ left, top, width: WIDTH, maxHeight: bounds.height - top - MARGIN }}
      className="menu-pop absolute z-[55] flex flex-col overflow-hidden rounded-[14px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl"
    >
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-[#e5e5e5]">Share {target.label}</h2>
            <div className="mt-0.5 truncate text-xs text-[#919191]">{project} · from this Mac</div>
          </div>
          {ready ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#22d3ee]/12 px-2 py-0.5 text-[11px] font-semibold text-[#22d3ee]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
              Link ready
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#242424] px-2 py-0.5 text-[11px] text-[#919191]">
              Making the link…
            </span>
          )}
        </div>

        {ready && (
          <>
            <div className="mt-3.5">
              <ShareLinkRow
                link={shortShareLink(ready.payload)}
                title={shareLink(ready.payload)}
                copied={copied}
                qrOpen={qrOpen}
                onCopy={() => copy(shareLink(ready.payload))}
                onToggleQr={() => setQrOpen((o) => !o)}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#919191]">
              {copied
                ? "On your clipboard. It opens in lpm, or in any browser."
                : "Opens in lpm, or in any browser with nothing to install."}
            </p>
            {qrOpen && (
              <div className="mt-3">
                <ShareQrCode seed={ready.payload} />
              </div>
            )}
            <div className="mt-4">
              <ShareAccessPicker
                canType={ready.canType}
                onChange={(canType) => shares.setCanType(target.key, canType)}
              />
            </div>
            <div className="mt-4">
              <SharePeople
                share={ready}
                onRespond={(id, allow) => shares.respond(target.key, id, allow)}
                onSetGuestCanType={(id, canType) => shares.setGuestCanType(target.key, id, canType)}
                onRemoveGuest={(id) => shares.removeGuest(target.key, id)}
                onTakeKeyboards={() => shares.takeKeyboards(target.key)}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#919191]">
              <ArrowDown size={13} className="shrink-0" />
              They see what happens from now on, not what&apos;s above.
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[#2e2e2e] px-3 py-2.5">
        {share ? (
          <button
            type="button"
            onClick={() => shares.stop(target.key)}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#f87171] transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
          >
            Stop sharing
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={close}
          className={`rounded-lg border border-[#2e2e2e] px-3.5 py-1.5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:bg-[#2a2a2a] ${FOCUS_RING}`}
        >
          Done
        </button>
      </div>
    </div>
  );
}
