import { PeerInvoke, PeerShareStart, PeerState } from "../../bridge/commands";
import { parsePeerMarker } from "../peer/markers";
import { routedInvoke } from "../peer/route";
import { peerAlias, type PeerStateShape } from "../peer/usePeerState";
import {
  applyMachineShares,
  useTabShares,
  type HostedShare,
  type ShareTarget,
} from "../store/tabShares";

// Every change to a shared tab, made where the tab runs: on this machine, or on
// the paired machine it's on (tabshare/machines.rs). Either answers with how its
// shares stand now.

function onHost(share: HostedShare, cmd: string, args: Record<string, unknown>): Promise<void> {
  const slug = share.machine;
  if (slug) return PeerInvoke(slug, cmd, args).then((rows: unknown) => void applyMachineShares(slug, rows));
  return routedInvoke(cmd, args).then((rows) => useTabShares.getState().setHosted(rows as HostedShare[]));
}

async function checkMachineShares(slug: string): Promise<void> {
  const state = (await PeerState()) as PeerStateShape;
  const peer = state.peers.find((p) => p.slug === slug);
  const name = peerAlias(state.peers, slug);
  if (!peer?.connected) throw new Error(`${name} isn't connected.`);
  if (!peer.supportsTabShare) throw new Error(`Update lpm on ${name} to share its tabs.`);
}

// Share the target's tab, and answer with its share.
export async function startShare(target: ShareTarget, project: string): Promise<HostedShare | undefined> {
  const marker = parsePeerMarker(target.terminalId);
  let rows: HostedShare[];
  if (marker) {
    await checkMachineShares(marker.slug);
    const answer = await PeerInvoke(marker.slug, "peer_share_start", {
      terminalId: marker.raw,
      project,
      label: target.label,
    });
    rows = applyMachineShares(marker.slug, answer);
  } else {
    rows = await PeerShareStart(target.terminalId, project, target.label);
    useTabShares.getState().setHosted(rows);
  }
  return rows.find((r) => r.terminalId === target.terminalId);
}

export function stopShare(share: HostedShare): Promise<void> {
  return onHost(share, "peer_share_stop", { id: share.id });
}

export function setShareCanType(share: HostedShare, canType: boolean): Promise<void> {
  return onHost(share, "peer_share_set_can_type", { id: share.id, canType });
}

// Let in, or turn away, someone asking to join.
export function respondToJoin(
  share: HostedShare,
  request: string,
  allow: boolean,
  canType?: boolean,
): Promise<void> {
  return onHost(share, "peer_share_respond", { request, allow, canType });
}

export function setGuestCanType(share: HostedShare, guest: string, canType: boolean): Promise<void> {
  return onHost(share, "peer_share_set_guest_can_type", { id: share.id, guest, canType });
}

export function declineAsk(share: HostedShare, guest: string): Promise<void> {
  return onHost(share, "peer_share_decline_ask", { id: share.id, guest });
}

export function removeGuest(share: HostedShare, guest: string): Promise<void> {
  return onHost(share, "peer_share_remove_guest", { id: share.id, guest });
}

export function takeKeyboards(share: HostedShare): Promise<void> {
  return onHost(share, "peer_share_take_keyboards", { id: share.id });
}
