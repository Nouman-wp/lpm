import type { PhoneDevice } from "./phoneStatus";

// How long a code works, for a machine on a release that doesn't say.
export const PAIRING_CODE_MS = 10 * 60_000;

// What became of the code on screen: still waiting, used by a phone, or no
// longer armed (expired, or used up elsewhere).
export type PairingOutcome =
  | { kind: "waiting" }
  | { kind: "paired"; device: PhoneDevice }
  | { kind: "withdrawn" };

export const WAITING: PairingOutcome = { kind: "waiting" };

// The part of a machine's phone state that says what became of a code.
export interface PairingRead {
  devices: PhoneDevice[];
  hasPendingCode: boolean;
}

export function asPairingRead(raw: unknown): PairingRead | null {
  const read = raw as Partial<PairingRead> | null;
  if (!read || !Array.isArray(read.devices)) return null;
  return { devices: read.devices, hasPendingCode: Boolean(read.hasPendingCode) };
}

export function pairingDeadline(expiresAt: number | undefined, receivedAt: number): number {
  return expiresAt ?? receivedAt + PAIRING_CODE_MS;
}

export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

// "9:42"
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// A phone that wasn't paired when the code was made has used it.
export function readOutcome(known: ReadonlySet<string>, fresh: PairingRead): PairingOutcome {
  const device = fresh.devices.find((d) => !known.has(d.id));
  if (device) return { kind: "paired", device };
  return fresh.hasPendingCode ? WAITING : { kind: "withdrawn" };
}

export function deviceName(device: PhoneDevice): string {
  return device.name || device.phoneName || "Device";
}
