import { useCallback, useState } from "react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PeerRemove } from "../../../bridge/commands";
import type { PeerClient, PeerHostState } from "../../peer/usePeerState";
import { usePeerConnect } from "../../peer/usePeerConnect";
import { connectsOnlyToMacs, peerNoun } from "../../peer/platform";
import { Group, GroupHeader } from "./GroupedList";
import { PeerRow } from "./PeerRow";
import { AddRow } from "./AddRow";
import { AddMacPanel } from "./AddMacPanel";
import { ClipboardInviteRow } from "./ClipboardInviteRow";
import { NearbyMacRow } from "./NearbyMacRow";
import { isMac } from "../../platform";
import { MACHINE } from "../../machineWords";

export function MacsSection({
  macs,
  peers,
  host,
  refresh,
  cancelPairingOnLeave = false,
}: {
  macs: PeerClient[];
  peers: PeerClient[];
  host: PeerHostState;
  refresh: () => Promise<void>;
  cancelPairingOnLeave?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [removePeer, setRemovePeer] = useState<PeerClient | null>(null);
  const pairing = usePeerConnect({ peers, host, refresh, cancelOnUnmount: cancelPairingOnLeave });

  // An invite that pairs folds the add panel away; one that fails leaves it open
  // with what was typed.
  const closeOnPair = useCallback(async (attempt: Promise<string | null>) => {
    const paired = (await attempt) !== null;
    if (paired) setAddOpen(false);
    return paired;
  }, []);

  // With nothing connected there is no list to keep tidy, and the field is the
  // whole point of the section — so it starts open and only folds away once
  // this Mac has somewhere to connect to.
  const panelOpen = addOpen || macs.length === 0;
  const onlyMacs = connectsOnlyToMacs(macs, isMac);

  return (
    <section className="mt-8">
      <GroupHeader>{onlyMacs ? "Macs you connect to" : "Computers you connect to"}</GroupHeader>
      <Group>
        {macs.map((p) => (
          <PeerRow key={p.slug} peer={p} onRemove={setRemovePeer} refresh={refresh} />
        ))}

        {pairing.clipboard && (
          <ClipboardInviteRow
            invite={pairing.clipboard.invite}
            busy={pairing.adding}
            onConnect={() => void closeOnPair(pairing.connectClipboard())}
            onDismiss={pairing.dismissClipboard}
          />
        )}

        {pairing.nearby.map((m) => (
          <NearbyMacRow
            key={m.id}
            mac={m}
            waiting={pairing.request?.id === m.id}
            sas={pairing.request?.id === m.id ? pairing.request.sas : ""}
            disabled={pairing.request !== null}
            onConnect={() => void pairing.connectNearby(m)}
            onCancel={pairing.cancelRequest}
          />
        ))}

        {macs.length > 0 && (
          <AddRow
            title={isMac ? "Connect another Mac" : "Connect another computer"}
            description="Paste the invite it created, or enter its details."
            expanded={addOpen}
            onClick={() => setAddOpen((v) => !v)}
          />
        )}
        {panelOpen && (
          <AddMacPanel
            busy={pairing.adding}
            onInvite={(raw) => closeOnPair(pairing.connectInvite(raw))}
            onManual={(address, port, code) => closeOnPair(pairing.connectManual(address, port, code))}
          />
        )}
      </Group>

      {pairing.error && <p className="mt-2 px-1 text-[11px] text-[var(--accent-red)]">{pairing.error}</p>}

      <ConfirmDialog
        open={removePeer !== null}
        title={`Disconnect ${removePeer ? peerNoun(removePeer) : "Mac"}`}
        variant="destructive"
        confirmLabel="Disconnect"
        body={
          <>
            Disconnect from{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {removePeer?.alias || removePeer?.host}
            </span>
            ? Its projects will no longer appear here, and {MACHINE.thisMachine} is removed there too.
          </>
        }
        onCancel={() => setRemovePeer(null)}
        onConfirm={() => {
          if (removePeer) void PeerRemove(removePeer.slug).then(refresh);
          setRemovePeer(null);
        }}
      />
    </section>
  );
}
