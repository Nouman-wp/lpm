import { ChevronDown, Laptop, Server } from "lucide-react";
import { MACHINE } from "../../machineWords";
import { isLinuxHost } from "../../peer/platform";
import type { PeerClient } from "../../peer/usePeerState";

// Whose settings the view shows: this machine's, or a connected one's. Absent
// while there is no other machine to choose.
export function SettingsMachinePicker({
  peers,
  value,
  onChange,
}: {
  peers: PeerClient[];
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  if (peers.length === 0) return null;
  const selected = peers.find((p) => p.slug === value);
  const Icon = selected && isLinuxHost(selected) ? Server : Laptop;
  return (
    <div className="relative mb-2">
      <Icon
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
      <select
        aria-label="Machine"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none truncate rounded-md border border-[var(--border)] bg-[var(--bg-primary)] py-1.5 pl-8 pr-7 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--text-muted)] focus:border-[var(--text-primary)]/40"
      >
        <option value="">{MACHINE.ThisMachineTitle}</option>
        {peers.map((peer) => (
          <option key={peer.slug} value={peer.slug}>
            {peer.alias || peer.host}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </div>
  );
}
