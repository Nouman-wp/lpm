import { useMemo } from "react";
import { peerAlias, type PeerClient } from "../../peer/usePeerState";
import { useAppStore } from "../../store/app";
import { machineCommands, THIS_MACHINE, type MachineScope } from "./machineCommands";

// The machine Settings shows, for the pages it opens.
export function useSettingsMachine(peers: PeerClient[]): MachineScope {
  const slug = useAppStore((s) => s.settingsMachine);
  const name = slug ? peerAlias(peers, slug) : null;
  return useMemo(() => (slug ? { slug, name, commands: machineCommands(slug) } : THIS_MACHINE), [slug, name]);
}
