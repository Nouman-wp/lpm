import { useState, type ReactNode } from "react";
import { PairingReach } from "./mobile/PairingReach";
import { LocalOnlyGate } from "./mobile/LocalOnlyGate";
import { isTailscaleAddress } from "../mobile/reachStatus";
import { MACHINE } from "../machineWords";

export interface Pairing {
  code: string;
  url: string;
  svg: string | null;
  host: string;
  hosts: string[];
  port: number;
}

/** A pairing code to scan: the QR, the code to type, and where it works. A code
 *  that only works on this network stays hidden until the user agrees to that —
 *  remembered per code, so a fresh one asks again. */
export function PairingCode({
  pairing,
  machine,
  onSetUpTailscale,
  onCancel,
  actions,
}: {
  pairing: Pairing;
  // Names the machine the QR pairs with when it isn't this one (a connected
  // host minted the code; the phone will talk to it directly).
  machine?: string;
  // Offered when the code carries no away-from-home address.
  onSetUpTailscale?: () => void;
  onCancel: () => void;
  // Under the code once it shows.
  actions: ReactNode;
}) {
  const [acceptedCode, setAcceptedCode] = useState<string | null>(null);
  const hosts = pairing.hosts?.length ? pairing.hosts : [pairing.host];
  const showCode = hosts.some(isTailscaleAddress) || acceptedCode === pairing.code;

  if (!showCode) {
    return (
      <LocalOnlyGate
        machine={machine ?? MACHINE.thisMachine}
        isThisMachine={!machine}
        onSetUpTailscale={onSetUpTailscale}
        onAccept={() => setAcceptedCode(pairing.code)}
        onCancel={onCancel}
      />
    );
  }

  return (
    <>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Open lpm Link and scan this code, or tap Enter a code. It works once and expires after 10 minutes.
        {machine
          ? ` The phone connects straight to that machine, so it keeps working while ${MACHINE.thisMachine} is off.`
          : ""}
      </p>
      <div className="mt-4 flex flex-col items-center gap-3">
        {pairing.svg ? (
          <div
            className="rounded-lg bg-white p-3"
            // The Rust side builds the QR as a self-contained SVG string.
            dangerouslySetInnerHTML={{ __html: pairing.svg }}
          />
        ) : (
          <div className="text-[11px] text-[var(--text-muted)]">QR unavailable — enter the code manually.</div>
        )}
        <div className="text-center">
          <p className="font-mono text-lg tracking-widest text-[var(--text-primary)]">{pairing.code}</p>
          <div className="mt-1 space-y-0.5">
            {hosts.map((h) => (
              <p key={h} className="font-mono text-[11px] text-[var(--text-muted)]">
                {h}:{pairing.port}
              </p>
            ))}
          </div>
        </div>
      </div>
      <PairingReach hosts={hosts} machine={machine ?? MACHINE.thisMachine} onSetUpTailscale={onSetUpTailscale} />
      {actions}
    </>
  );
}
