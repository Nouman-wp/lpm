import { Clipboard, Link2 } from "lucide-react";
import { shortShareLink, type ShareInvite } from "../../share/invite";

// A link found ready to join (on the clipboard, or opened from lpm.cx), named
// by what it says it opens.
export function JoinInviteOffer({
  link,
  invite,
  fromClipboard,
  onJoin,
}: {
  link: string;
  invite: ShareInvite;
  fromClipboard: boolean;
  onJoin: () => void;
}) {
  const Icon = fromClipboard ? Clipboard : Link2;
  const about = [invite.label, invite.hostName && `on ${invite.hostName}`].filter(Boolean).join(" ");
  return (
    <div className="rounded-xl border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/5 p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
        <Icon size={15} className="shrink-0 text-[var(--accent-cyan)]" />
        {fromClipboard ? "From your clipboard" : "From the link you opened"}
      </div>
      {about && <div className="mt-1.5 truncate text-[13px] text-[var(--text-primary)]">{about}</div>}
      <div className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]" title={link}>
        {shortShareLink(link)}
      </div>
      <button
        type="button"
        onClick={onJoin}
        className="mt-3 h-9 w-full rounded-[9px] bg-[var(--text-primary)] text-[13px] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
      >
        Join this tab
      </button>
    </div>
  );
}
