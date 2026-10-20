import { usePeerState } from "../peer/usePeerState";
import { isLinuxHost } from "../peer/platform";
import { MACHINE } from "../machineWords";
import { ThisMachineCard } from "./connections/ThisMachineCard";
import { MachinesSection } from "./connections/MachinesSection";
import { LinuxHostsSection } from "./connections/LinuxHostsSection";
import { SyncSection } from "./connections/SyncSection";

// This machine first — whether others may open it, and every way they reach it —
// then every computer in one list, a row each whichever way they connect.
//
// Linux hosts get their own list: they're headless servers you keep work running
// on, not machines someone is sitting at, and they're brought online differently.
// A Linux or Windows desktop is someone's machine, so it sits with the Macs.
export function ConnectionsPane({
  cancelPairingOnLeave = false,
  showLinuxHosts = true,
}: {
  cancelPairingOnLeave?: boolean;
  showLinuxHosts?: boolean;
}) {
  const { state, refresh } = usePeerState();
  const linuxHosts = state.peers.filter(isLinuxHost);
  const macs = state.peers.filter((p) => !isLinuxHost(p));

  return (
    <div className="mt-2">
      <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
        Connect {MACHINE.thisMachine} to {MACHINE.anotherMachine}
        {showLinuxHosts && ", or to a Linux server,"} and work across both from one place.
        A connected machine's projects appear in your sidebar and open just like local ones.
      </p>
      <ThisMachineCard
        host={state.host}
        refresh={refresh}
        peersOverTailscale={state.peers.some((p) => p.overTailscale)}
      />
      <MachinesSection
        macs={macs}
        peers={state.peers}
        host={state.host}
        refresh={refresh}
        cancelPairingOnLeave={cancelPairingOnLeave}
      />
      {showLinuxHosts && <LinuxHostsSection hosts={linuxHosts} refresh={refresh} />}
      {showLinuxHosts && linuxHosts.length > 0 && <SyncSection peers={linuxHosts} />}
    </div>
  );
}
