import { useEffect, useRef } from "react";
import { usePeerState } from "../peer/usePeerState";
import { useAppStore } from "../store/app";
import { ConnectionsPane } from "./ConnectionsPane";

// The picker's way onto another computer running lpm: Settings → Connections,
// so everything there works the same here, minus Linux hosts, which the picker
// adds under Server. A computer added from it carries on to adding a project on
// that computer once it's connected.
export function AnotherComputerScreen() {
  const addProjectForPeer = useAppStore((s) => s.addProjectForPeer);
  const { state, loaded } = usePeerState();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!known.current) {
      known.current = new Set(state.peers.map((p) => p.slug));
      return;
    }
    const added = state.peers.find((p) => !known.current?.has(p.slug) && p.enabled && p.connected);
    if (added) addProjectForPeer(added.slug, added.alias || added.host, true);
  }, [loaded, state.peers, addProjectForPeer]);

  return (
    <div className="max-h-[min(720px,80vh)] overflow-y-auto px-5 pb-5">
      <ConnectionsPane cancelPairingOnLeave showLinuxHosts={false} />
    </div>
  );
}
