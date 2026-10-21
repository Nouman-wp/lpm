"use client";

import { Check, Link2, QrCode } from "lucide-react";
import { FOCUS_RING, PRESS } from "./ui";

// Ports the app's ShareLinkRow: the link, a QR for a phone, and Copy.
export function ShareLinkRow({
  link,
  title,
  copied,
  qrOpen,
  onCopy,
  onToggleQr,
}: {
  link: string;
  title: string;
  copied: boolean;
  qrOpen: boolean;
  onCopy: () => void;
  onToggleQr: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[#2e2e2e] bg-[#242424] py-1.5 pl-3 pr-1.5">
      <Link2 size={14} className="shrink-0 text-[#919191]" />
      <span title={title} className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#b3b3b3]">
        {link}
      </span>
      <button
        type="button"
        onClick={onToggleQr}
        aria-label={qrOpen ? "Hide QR code" : "Show QR code"}
        aria-pressed={qrOpen}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#b3b3b3] transition-colors hover:bg-[#2a2a2a] ${
          qrOpen ? "bg-[#333333]" : ""
        } ${FOCUS_RING}`}
      >
        <QrCode size={15} />
      </button>
      <button
        type="button"
        onClick={onCopy}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${PRESS} ${FOCUS_RING} ${
          copied ? "bg-[#4ade80]/15 text-[#4ade80]" : "bg-[#22d3ee] text-white hover:opacity-90"
        }`}
      >
        {copied && <Check size={13} strokeWidth={2.5} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
