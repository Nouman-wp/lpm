import { Modal } from "../ui/Modal";
import type { PeerHostPairing } from "../../peer/usePeerState";
import type { PeerConnect } from "../../peer/usePeerConnect";
import { Group, GroupHeader, Row } from "./GroupedList";
import { NearbyMacRow } from "./NearbyMacRow";
import { AddMacPanel } from "./AddMacPanel";
import { PairingInviteRow } from "./PairingInviteRow";
import { SECONDARY_BUTTON } from "../mobile/styles";
import { isMac } from "../../platform";
import { MACHINE as M } from "../../machineWords";

// Every way to add a computer, in the order people reach for them: one found on
// this network, then an invite either way. Each direction is its own step — this
// one opening that one, and that one opening this one.
export function AddMachineModal({
  open,
  onClose,
  connect,
  onPaired,
  pairing,
  pairingBusy,
  onCreateInvite,
  onCancelInvite,
}: {
  open: boolean;
  onClose: () => void;
  connect: PeerConnect;
  // Wraps an invite attempt: resolves whether it paired, closing the dialog when it did.
  onPaired: (attempt: Promise<string | null>) => Promise<boolean>;
  pairing: PeerHostPairing | null;
  pairingBusy: boolean;
  onCreateInvite: () => void;
  onCancelInvite: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="max-h-[85vh] w-[480px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {isMac ? "Add a Mac" : "Add a computer"}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        Connect {M.thisMachine} to {M.anotherMachine} running lpm. Each way is set up on its own.
      </p>

      {connect.nearby.length > 0 && (
        <>
          <GroupHeader className="mt-5">On this network</GroupHeader>
          <Group>
            {connect.nearby.map((m) => (
              <NearbyMacRow
                key={m.id}
                mac={m}
                waiting={connect.request?.id === m.id}
                sas={connect.request?.id === m.id ? connect.request.sas : ""}
                disabled={connect.request !== null}
                onConnect={() => void onPaired(connect.connectNearby(m))}
                onCancel={connect.cancelRequest}
              />
            ))}
          </Group>
        </>
      )}

      <GroupHeader className="mt-5">Open its projects here</GroupHeader>
      <Group>
        <AddMacPanel
          busy={connect.adding}
          onInvite={(raw) => onPaired(connect.connectInvite(raw))}
          onManual={(address, port, code) => onPaired(connect.connectManual(address, port, code))}
        />
      </Group>
      {connect.error && <p className="mt-2 px-1 text-[11px] text-[var(--accent-red)]">{connect.error}</p>}

      <GroupHeader className="mt-5">Let it open {M.thisMachine}</GroupHeader>
      <Group>
        {pairing ? (
          <PairingInviteRow pairing={pairing} onCancel={onCancelInvite} />
        ) : (
          <Row>
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Create a one-time invite, then paste it on {M.otherMachine}.
            </p>
            <button type="button" onClick={onCreateInvite} disabled={pairingBusy} className={SECONDARY_BUTTON}>
              {pairingBusy ? "Preparing…" : "Create invite"}
            </button>
          </Row>
        )}
      </Group>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
