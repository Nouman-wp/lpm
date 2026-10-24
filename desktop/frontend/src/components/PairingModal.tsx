import { useState } from "react";
import { Modal } from "./ui/Modal";
import { LocalOnlyGate } from "./mobile/LocalOnlyGate";
import { PairingBody } from "./mobile/PairingBody";
import { isTailscaleAddress } from "../mobile/reachStatus";
import type { PairingOutcome } from "../mobile/pairingCode";
import { MACHINE } from "../machineWords";

export interface Pairing {
  code: string;
  url: string;
  svg: string | null;
  host: string;
  hosts: string[];
  port: number;
  // When the code stops working, in ms since the epoch; a machine on an older
  // release leaves it out.
  expiresAt?: number;
}

export function PairingModal({
  pairing,
  machine,
  outcome,
  busy,
  onClose,
  onSetUpTailscale,
  onNewCode,
  onRename,
}: {
  pairing: Pairing | null;
  // Names the machine the QR pairs with when it isn't this Mac (a connected
  // host minted the code; the phone will talk to it directly).
  machine?: string;
  // What became of the code, when the caller follows it.
  outcome?: PairingOutcome;
  // A new code is on its way.
  busy?: boolean;
  onClose: () => void;
  // Offered when the code carries no away-from-home address.
  onSetUpTailscale?: () => void;
  // Replaces an expired code in place.
  onNewCode?: () => void;
  onRename?: (id: string, name: string) => void;
}) {
  // A code that only works on this network stays hidden until the user agrees
  // to that — remembered while the dialog stays open, so a new code made in
  // place doesn't ask again but the next pairing does.
  const [accepted, setAccepted] = useState(false);
  if (!pairing && accepted) setAccepted(false);
  const hosts = pairing ? (pairing.hosts?.length ? pairing.hosts : [pairing.host]) : [];
  const showCode = !!pairing && (hosts.some(isTailscaleAddress) || accepted || outcome?.kind === "paired");
  const title = machine ? `Pair a device with ${machine}` : "Pair a device";

  return (
    <Modal
      open={pairing !== null}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="w-[420px] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      {pairing &&
        (showCode ? (
          <PairingBody
            key={pairing.code}
            pairing={pairing}
            hosts={hosts}
            title={title}
            machine={machine}
            outcome={outcome}
            busy={busy}
            onClose={onClose}
            onSetUpTailscale={onSetUpTailscale}
            onNewCode={onNewCode}
            onRename={onRename}
          />
        ) : (
          <>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            <LocalOnlyGate
              machine={machine ?? MACHINE.thisMachine}
              isThisMachine={!machine}
              onSetUpTailscale={onSetUpTailscale}
              onAccept={() => setAccepted(true)}
              onCancel={onClose}
            />
          </>
        ))}
    </Modal>
  );
}
