import { useCallback, useEffect, useRef, useState } from "react";
import type { Pairing } from "../PairingModal";
import type { MobileCommands } from "../settings/mobileCommands";
import {
  WAITING,
  asPairingRead,
  pairingDeadline,
  readOutcome,
  type PairingOutcome,
} from "../../mobile/pairingCode";

const POLL_MS = 2000;

interface Shown {
  pairing: Pairing;
  source: MobileCommands;
  // The phones the machine had when the code was made; null when it couldn't
  // say, so what becomes of the code can't be followed.
  known: Set<string> | null;
  outcome: PairingOutcome;
}

export interface PairingFlow {
  pairing: Pairing | null;
  // Unset while the code can't be followed.
  outcome: PairingOutcome | undefined;
  busy: boolean;
  start: (source: MobileCommands) => Promise<void>;
  close: () => void;
  rename: (id: string, name: string) => Promise<unknown>;
}

// A pairing code on screen and what became of it, read from its machine every
// couple of seconds while the code waits.
export function usePairingFlow(): PairingFlow {
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped whenever the code on screen changes, so a read about an older one
  // lands nowhere.
  const generation = useRef(0);

  const start = useCallback(async (source: MobileCommands) => {
    const gen = ++generation.current;
    setBusy(true);
    try {
      const [before, minted] = await Promise.all([
        source.state().then(asPairingRead, () => null),
        source.startPairing() as Promise<Pairing>,
      ]);
      if (gen !== generation.current) return;
      setShown({
        pairing: { ...minted, expiresAt: pairingDeadline(minted.expiresAt, Date.now()) },
        source,
        known: before && new Set(before.devices.map((d) => d.id)),
        outcome: WAITING,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const close = useCallback(() => {
    generation.current += 1;
    setShown(null);
  }, []);

  useEffect(() => {
    if (!shown?.known || shown.outcome.kind !== "waiting") return;
    const { source, known } = shown;
    const gen = generation.current;
    const timer = window.setInterval(async () => {
      const fresh = await source.state().then(asPairingRead, () => null);
      if (!fresh || gen !== generation.current) return;
      const outcome = readOutcome(known, fresh);
      if (outcome.kind === "waiting") return;
      setShown((s) => (s && gen === generation.current ? { ...s, outcome } : s));
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [shown]);

  const rename = useCallback(
    async (id: string, name: string) => {
      if (!shown) throw new Error("The pairing is no longer open");
      const answer = await shown.source.renameDevice(id, name);
      const renamed = asPairingRead(answer)?.devices.find((d) => d.id === id);
      setShown((s) =>
        s?.outcome.kind === "paired" && s.outcome.device.id === id
          ? { ...s, outcome: { kind: "paired", device: renamed ?? { ...s.outcome.device, name } } }
          : s,
      );
      return answer;
    },
    [shown],
  );

  return {
    pairing: shown?.pairing ?? null,
    outcome: shown?.known ? shown.outcome : undefined,
    busy,
    start,
    close,
    rename,
  };
}
