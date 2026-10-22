import { MACHINE } from "../machineWords";
import { machineEntries } from "./machineEntries";
import { peerAlias, type PeerStateShape } from "./usePeerState";

// A computer an automation can run on, by the hostId its `machines:` names it
// with. `slug` is set for one this computer connects to, which is the only
// kind a new automation can be saved on.
export interface MachineChoice {
  id: string;
  label: string;
  slug?: string;
  connected: boolean;
}

// This computer first, then each paired one once, whichever way round they
// paired. One paired before hostIds were sent can't be named, so it's left out.
export function machineChoices(state: PeerStateShape): MachineChoice[] {
  const others: MachineChoice[] = [];
  for (const { peer, device } of machineEntries(state.peers, state.host.devices)) {
    const id = peer?.hostId || device?.hostId;
    if (!id || id === state.host.hostId || others.some((c) => c.id === id)) continue;
    others.push({
      id,
      label: peer ? peerAlias(state.peers, peer.slug) : device?.name || MACHINE.AnotherMachine,
      slug: peer?.slug,
      connected: peer?.connected ?? false,
    });
  }
  others.sort((a, b) => a.label.localeCompare(b.label));
  if (!state.host.hostId) return others;
  return [{ id: state.host.hostId, label: MACHINE.ThisMachineTitle, connected: true }, ...others];
}
