import { peerSlugOf } from "./peer/markers";
import { isLinuxHost } from "./peer/platform";
import type { PeerClient } from "./peer/usePeerState";
import { isMac } from "./platform";

// The machine the Settings view configures: this one, or one connected to it.
export type SettingsMachine = LocalMachine | PeerMachine;

export interface LocalMachine {
  kind: "local";
}

export interface PeerMachine {
  kind: "peer";
  slug: string;
  name: string;
  // Someone sits at it, so how its screen looks and sounds is worth setting.
  attended: boolean;
  // It takes a Mac's shortcuts rather than a PC's.
  mac: boolean;
  // The lpm it runs; empty until it says.
  version: string;
}

export const LOCAL_MACHINE: LocalMachine = { kind: "local" };

export function peerMachine(peer: PeerClient): PeerMachine {
  return {
    kind: "peer",
    slug: peer.slug,
    name: peer.alias || peer.host,
    attended: !isLinuxHost(peer),
    // An entry too old to report its platform is a Mac (see peer/platform.ts).
    mac: !peer.platform || peer.platform === "macos",
    version: peer.version ?? "",
  };
}

// Which connected machines a setting is there for, besides this one. Unset, it
// is this machine's alone: it runs here or is kept here. "attended" is for how a
// screen looks and sounds, so a machine nobody sits at goes without it.
// "sameKeyboard" is for shortcuts, which are recorded on this keyboard.
export type SettingsReach = "any" | "attended" | "sameKeyboard";

export function reaches(
  machine: SettingsMachine,
  reach: SettingsReach | undefined,
  thisIsMac: boolean = isMac,
): boolean {
  if (machine.kind === "local") return true;
  switch (reach) {
    case "any":
      return true;
    case "attended":
      return machine.attended;
    case "sameKeyboard":
      return machine.attended && machine.mac === thisIsMac;
    default:
      return false;
  }
}

// Whether a listed project lives on the machine, rather than on another one
// whose projects are listed here too.
export function isOnMachine(projectName: string, machine: SettingsMachine): boolean {
  const slug = peerSlugOf(projectName);
  return machine.kind === "local" ? slug === null : slug === machine.slug;
}
