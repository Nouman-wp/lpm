import { useState } from "react";
import type { Pairing } from "../PairingModal";
import { PairingExpired } from "./PairingExpired";
import { PairingPaired } from "./PairingPaired";
import { PairingWaiting } from "./PairingWaiting";
import { useNow } from "../../hooks/useNow";
import { MACHINE } from "../../machineWords";
import { pairingDeadline, secondsLeft, type PairingOutcome } from "../../mobile/pairingCode";

/** One pairing code from showing to its end: waiting for a phone, the phone
 *  that used it, or expired. Keyed by the code, so a new one starts over. */
export function PairingBody({
  pairing,
  hosts,
  title,
  machine,
  outcome,
  busy,
  onClose,
  onSetUpTailscale,
  onNewCode,
  onRename,
}: {
  pairing: Pairing;
  hosts: string[];
  title: string;
  machine?: string;
  outcome?: PairingOutcome;
  busy?: boolean;
  onClose: () => void;
  onSetUpTailscale?: () => void;
  onNewCode?: () => void;
  onRename?: (id: string, name: string) => void;
}) {
  const [receivedAt] = useState(Date.now);
  const paired = outcome?.kind === "paired" ? outcome.device : null;
  const ended = !!paired || outcome?.kind === "withdrawn";
  const now = useNow(!ended, 1000);
  const left = secondsLeft(pairingDeadline(pairing.expiresAt, receivedAt), now);

  if (paired) {
    return (
      <PairingPaired device={paired} machine={machine ?? MACHINE.thisMachine} onRename={onRename} onDone={onClose} />
    );
  }
  if (ended || left === 0) {
    return <PairingExpired title={title} busy={busy} onNewCode={onNewCode} onClose={onClose} />;
  }
  return (
    <PairingWaiting
      pairing={pairing}
      hosts={hosts}
      title={title}
      machine={machine}
      secondsLeft={left}
      followed={!!outcome}
      onClose={onClose}
      onSetUpTailscale={onSetUpTailscale}
    />
  );
}
