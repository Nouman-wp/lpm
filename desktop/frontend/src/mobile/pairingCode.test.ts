import { describe, expect, it } from "vitest";
import {
  PAIRING_CODE_MS,
  asPairingRead,
  deviceName,
  formatCountdown,
  pairingDeadline,
  readOutcome,
  secondsLeft,
} from "./pairingCode";
import type { PhoneDevice } from "./phoneStatus";

const phone = (id: string, name = "", phoneName = "iPhone"): PhoneDevice => ({
  id,
  name,
  phoneName,
  createdAt: 0,
  connected: false,
  route: null,
  lastSeen: 0,
  lastRoute: null,
});

describe("the pairing countdown", () => {
  it("shows minutes and padded seconds", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(582)).toBe("9:42");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("rounds a part second up and stops at zero", () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 25_000)).toBe(0);
  });

  it("runs to the machine's own expiry, else ten minutes from arrival", () => {
    expect(pairingDeadline(1_234, 0)).toBe(1_234);
    expect(pairingDeadline(undefined, 5_000)).toBe(5_000 + PAIRING_CODE_MS);
  });
});

describe("what became of a code", () => {
  const known = new Set(["a"]);

  it("is used by a phone the machine didn't have", () => {
    const outcome = readOutcome(known, { devices: [phone("a"), phone("b", "Ada's iPhone")], hasPendingCode: false });
    expect(outcome).toEqual({ kind: "paired", device: phone("b", "Ada's iPhone") });
  });

  it("waits while the code is armed and no phone is new", () => {
    expect(readOutcome(known, { devices: [phone("a")], hasPendingCode: true })).toEqual({ kind: "waiting" });
  });

  it("is withdrawn once the machine no longer holds it", () => {
    expect(readOutcome(known, { devices: [phone("a")], hasPendingCode: false })).toEqual({ kind: "withdrawn" });
  });

  it("reads only a state that lists devices", () => {
    expect(asPairingRead(null)).toBeNull();
    expect(asPairingRead({ hasPendingCode: true })).toBeNull();
    expect(asPairingRead({ devices: [], hasPendingCode: 1 })).toEqual({ devices: [], hasPendingCode: true });
  });

  it("names a phone by its name here, else its own", () => {
    expect(deviceName(phone("a", "Desk phone"))).toBe("Desk phone");
    expect(deviceName(phone("a"))).toBe("iPhone");
    expect(deviceName(phone("a", "", ""))).toBe("Device");
  });
});
