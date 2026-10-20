import type { PeerClient, PeerHostDevice } from "./usePeerState";

// One machine in the list: the peer this Mac opens, the device that opens this
// Mac, or both when the device reported the hostId the peer paired with.
export interface MachineEntry {
  key: string;
  peer: PeerClient | null;
  device: PeerHostDevice | null;
}

export function machineEntries(peers: PeerClient[], devices: PeerHostDevice[]): MachineEntry[] {
  const byHostId = new Map(devices.filter((d) => d.hostId).map((d) => [d.hostId, d]));
  const matched = new Set<string>();
  const entries: MachineEntry[] = peers.map((peer) => {
    const found = peer.hostId ? byHostId.get(peer.hostId) : undefined;
    const device = found && !matched.has(found.id) ? found : null;
    if (device) matched.add(device.id);
    return { key: peer.slug, peer, device };
  });
  for (const device of devices) {
    if (!matched.has(device.id)) entries.push({ key: `device:${device.id}`, peer: null, device });
  }
  return entries;
}
