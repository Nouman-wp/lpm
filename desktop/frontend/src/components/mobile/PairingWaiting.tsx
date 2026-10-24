import type { Pairing } from "../PairingModal";
import { Spinner } from "../settings/Spinner";
import { CopyCodeButton } from "./CopyCodeButton";
import { PairingReach } from "./PairingReach";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./styles";
import { formatCountdown } from "../../mobile/pairingCode";
import { MACHINE } from "../../machineWords";

/** The code a phone scans or types, counting down to when it stops working. */
export function PairingWaiting({
  pairing,
  hosts,
  title,
  machine,
  secondsLeft,
  followed,
  onClose,
  onSetUpTailscale,
}: {
  pairing: Pairing;
  hosts: string[];
  title: string;
  machine?: string;
  secondsLeft: number;
  // Whether this view hears when a phone uses the code; if not, closing it is
  // what the person does once their phone shows it paired.
  followed: boolean;
  onClose: () => void;
  onSetUpTailscale?: () => void;
}) {
  return (
    <>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Open lpm Link and scan this code, or tap Enter a code.
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
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-1 pl-6">
            <p className="font-mono text-lg tracking-widest text-[var(--text-primary)]">{pairing.code}</p>
            <CopyCodeButton code={pairing.code} />
          </div>
          <div className="mt-1 space-y-0.5">
            {hosts.map((h) => (
              <p key={h} className="font-mono text-[11px] text-[var(--text-muted)]">
                {h}:{pairing.port}
              </p>
            ))}
          </div>
          <span
            role="status"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent-blue) 10%, transparent)",
              color: "var(--accent-blue-text)",
            }}
          >
            <Spinner size={10} />
            Waiting for your phone… <span className="tabular-nums">{formatCountdown(secondsLeft)} left</span>
          </span>
        </div>
      </div>
      <PairingReach hosts={hosts} machine={machine ?? MACHINE.thisMachine} onSetUpTailscale={onSetUpTailscale} />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={followed ? SECONDARY_BUTTON : PRIMARY_BUTTON}>
          {followed ? "Cancel" : "Done"}
        </button>
      </div>
    </>
  );
}
