import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { PairingCode, type Pairing } from "../PairingCode";
import { PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON, TILE_STYLE } from "./styles";
import { LOCAL_MOBILE } from "../settings/mobileCommands";
import { peerCommands } from "../settings/machineCommands";
import { usePhoneServer } from "../../mobile/usePhoneServer";
import { useAwayReach } from "../../mobile/useAwayReach";
import { MACHINE } from "../../machineWords";

// The code expiring sends no event, so the machine is asked this often.
const CHECK_MS = 2000;

export interface PairMachine {
  slug: string;
  name: string;
}

/** A pairing code on the picker, watched until a new device turns up on the
 *  machine it pairs with — then that device, by name. */
export function PhonePairScreen({
  initial,
  mint,
  machine,
  onBack,
  onDone,
}: {
  initial: Pairing;
  mint: () => Promise<Pairing>;
  // A connected machine that minted the code; absent for this one.
  machine?: PairMachine;
  onBack: () => void;
  onDone: () => void;
}) {
  const slug = machine?.slug;
  const mobile = useMemo(() => (slug ? peerCommands(slug).mobile : LOCAL_MOBILE), [slug]);
  const { state, loaded, refresh, take } = usePhoneServer(mobile, CHECK_MS);
  const away = useAwayReach(state, take);
  const [pairing, setPairing] = useState(initial);
  // The devices there before the code showed: any other one paired with it.
  const [known, setKnown] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && known === null) setKnown(new Set(state.devices.map((d) => d.id)));
  }, [loaded, known, state.devices]);

  const paired = known ? state.devices.find((d) => !known.has(d.id)) : undefined;
  const lapsed = known !== null && !paired && !state.hasPendingCode;

  const renew = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await mint();
      setKnown(new Set(state.devices.map((d) => d.id)));
      setPairing(next);
      await refresh();
    } catch (err) {
      setError(`Couldn't get a new code${machine ? ` from ${machine.name}` : ""}. ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const errorLine = error && <p className="mt-3 text-[11px] text-[var(--accent-red-text)]">{error}</p>;

  if (paired) {
    const name = paired.name || paired.phoneName || "Your device";
    return (
      <div className="flex flex-col items-center px-6 pb-5 pt-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full" style={TILE_STYLE.live}>
          <Check size={20} />
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{name} is paired</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          {machine
            ? `It connects straight to ${machine.name}, so it keeps working while ${MACHINE.thisMachine} is off.`
            : "Open lpm Link on it to watch your terminals and run your projects."}
        </p>
        {errorLine}
        <div className="mt-5 flex gap-2">
          <button onClick={() => void renew()} disabled={busy} className={SECONDARY_BUTTON}>
            {busy ? "Preparing…" : "Pair another"}
          </button>
          <button onClick={onDone} className={PRIMARY_BUTTON}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (lapsed) {
    return (
      <div className="px-5 pb-4 pt-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">This code can&#39;t be used any more</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          It expired, or a newer one replaced it. Make a new one to pair a device.
        </p>
        {errorLine}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onBack} className={QUIET_BUTTON}>
            Back
          </button>
          <button onClick={() => void renew()} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Preparing…" : "New code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[min(640px,76vh)] overflow-y-auto px-5 pb-4">
      <PairingCode
        pairing={pairing}
        machine={machine?.name}
        onSetUpTailscale={
          machine
            ? undefined
            : () => {
                void away.setUpAway();
                onBack();
              }
        }
        onCancel={onBack}
        actions={
          <>
            {errorLine}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--accent-green)]" />
                Waiting for your device…
              </p>
              <button onClick={onDone} className={PRIMARY_BUTTON}>
                Done
              </button>
            </div>
          </>
        }
      />
    </div>
  );
}
