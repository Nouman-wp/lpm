import { Check, Link2, QrCode } from "lucide-react";
import { shortShareLink } from "../../share/invite";

export function ShareLinkRow({
  link,
  copied,
  qrOpen,
  onCopy,
  onToggleQr,
}: {
  link: string;
  copied: boolean;
  qrOpen: boolean;
  onCopy: () => void;
  // Absent when the link can't open on a phone (no relay for this share).
  onToggleQr?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg-secondary)] py-1.5 pl-3 pr-1.5">
      <Link2 size={14} className="shrink-0 text-[var(--text-muted)]" />
      <span
        title={link}
        className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text-secondary)]"
      >
        {shortShareLink(link)}
      </span>
      {onToggleQr && (
        <button
          type="button"
          onClick={onToggleQr}
          aria-label={qrOpen ? "Hide QR code" : "Show QR code"}
          aria-pressed={qrOpen}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] ${
            qrOpen ? "bg-[var(--bg-active)]" : ""
          }`}
        >
          <QrCode size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={onCopy}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors ${
          copied
            ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
            : "bg-[var(--accent-cyan)] text-white hover:opacity-90"
        }`}
      >
        {copied && <Check size={13} strokeWidth={2.5} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
