import { Server } from "lucide-react";
import { ChevronRightIcon } from "./icons";
import { LaptopIcon } from "./connections/LaptopIcon";
import { StatusLine } from "./connections/StatusLine";
import { peerStatus } from "../peer/peerStatus";
import { isLinuxHost } from "../peer/platform";
import type { PeerClient } from "../peer/usePeerState";

// A computer this one already pairs with. Only one that's connected can take a
// new project, so the rest say why not and can't be picked.
export function ConnectedComputerRow({
  peer,
  projectCount,
  onOpen,
}: {
  peer: PeerClient;
  projectCount: number;
  onOpen: () => void;
}) {
  const live = peer.enabled && peer.connected;
  const status = peerStatus(peer);
  const text =
    live && projectCount > 0
      ? `${status.text} · ${projectCount} ${projectCount === 1 ? "project" : "projects"}`
      : status.text;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!live}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors enabled:hover:bg-[var(--bg-hover)] disabled:opacity-60"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: live
            ? "color-mix(in srgb, var(--accent-green) 15%, transparent)"
            : "var(--bg-active)",
          color: live ? "var(--accent-green)" : "var(--text-muted)",
        }}
      >
        {isLinuxHost(peer) ? <Server size={16} /> : <LaptopIcon size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {peer.alias || peer.host}
        </p>
        <StatusLine tone={status.tone} text={text} detail={status.detail} />
      </div>
      {live && (
        <span className="flex shrink-0 text-[var(--text-muted)]">
          <ChevronRightIcon />
        </span>
      )}
    </button>
  );
}
