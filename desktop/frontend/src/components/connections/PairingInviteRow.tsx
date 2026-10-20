import type { PeerHostPairing } from "../../peer/usePeerState";
import { encodeInvite } from "../../peer/invite";
import { InviteChip } from "./InviteChip";
import { MACHINE as M } from "../../machineWords";

// An invite this machine made, waiting to be pasted on the other one. It stays
// in the list until it's used or cancelled: closing the pane never cancels it.
export function PairingInviteRow({ pairing, onCancel }: { pairing: PeerHostPairing; onCancel: () => void }) {
  const invite = encodeInvite({ hosts: pairing.hosts, port: pairing.port, code: pairing.code, fp: pairing.fp });

  return (
    <div
      className="px-4 py-4"
      style={{ backgroundColor: "color-mix(in srgb, var(--accent-green) 5%, transparent)" }}
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">Waiting for {M.anotherMachine} to join</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Copy this invite and paste it on {M.otherMachine}. It works once and stays active until used.
      </p>
      <InviteChip invite={invite} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] text-[var(--text-muted)]">
          Or enter manually:{" "}
          <span className="font-mono tracking-widest text-[var(--text-secondary)]">{pairing.code}</span> ·{" "}
          {pairing.hosts[0]}:{pairing.port}
        </p>
        <button
          onClick={onCancel}
          className="shrink-0 rounded-md px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
