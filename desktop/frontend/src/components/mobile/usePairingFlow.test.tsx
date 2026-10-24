// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileCommands } from "../settings/mobileCommands";
import type { PhoneDevice } from "../../mobile/phoneStatus";
import { usePairingFlow, type PairingFlow } from "./usePairingFlow";

const phone = (id: string, name = ""): PhoneDevice => ({
  id,
  name,
  phoneName: "iPhone",
  createdAt: 0,
  connected: false,
  route: null,
  lastSeen: 0,
  lastRoute: null,
});

const minted = (code: string, expiresAt?: number) => ({
  code,
  url: "lpm://pair",
  svg: null,
  host: "100.64.0.12",
  hosts: ["100.64.0.12"],
  port: 8765,
  expiresAt,
});

let container: HTMLDivElement;
let root: Root;
let flow: PairingFlow;

function Harness() {
  flow = usePairingFlow();
  return null;
}

function commands(reads: unknown[], codes = [minted("AAAA-BBBB", 99)]): MobileCommands {
  const state = vi.fn();
  for (const read of reads) state.mockResolvedValueOnce(read);
  state.mockResolvedValue(reads[reads.length - 1]);
  const startPairing = vi.fn();
  for (const code of codes) startPairing.mockResolvedValueOnce(code);
  return {
    state,
    startPairing,
    setConfig: vi.fn(),
    setKeepAwake: vi.fn(),
    renameDevice: vi.fn(async (id: string, name: string) => ({
      devices: [phone("a"), phone(id, name)],
      hasPendingCode: false,
    })),
    revokeDevice: vi.fn(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePairingFlow", () => {
  it("shows the code and hears which phone used it", async () => {
    const source = commands([
      { devices: [phone("a")], hasPendingCode: false },
      { devices: [phone("a")], hasPendingCode: true },
      { devices: [phone("a"), phone("b", "Ada's iPhone")], hasPendingCode: false },
    ]);
    await act(() => flow.start(source));
    expect(flow.pairing?.code).toBe("AAAA-BBBB");
    expect(flow.pairing?.expiresAt).toBe(99);
    expect(flow.outcome).toEqual({ kind: "waiting" });
    await tick(2000);
    expect(flow.outcome).toEqual({ kind: "waiting" });
    await tick(2000);
    expect(flow.outcome).toEqual({ kind: "paired", device: phone("b", "Ada's iPhone") });
  });

  it("reports a code its machine stopped holding", async () => {
    const source = commands([
      { devices: [phone("a")], hasPendingCode: false },
      { devices: [phone("a")], hasPendingCode: false },
    ]);
    await act(() => flow.start(source));
    await tick(2000);
    expect(flow.outcome).toEqual({ kind: "withdrawn" });
  });

  it("gives an older machine's code ten minutes and doesn't follow what it can't read", async () => {
    const source = commands([null], [minted("CCCC-DDDD")]);
    vi.setSystemTime(1_000);
    await act(() => flow.start(source));
    expect(flow.pairing?.expiresAt).toBe(1_000 + 10 * 60_000);
    expect(flow.outcome).toBeUndefined();
    await tick(4000);
    expect(source.state).toHaveBeenCalledOnce();
  });

  it("drops a code that arrives after the dialog closed", async () => {
    const source = commands([{ devices: [], hasPendingCode: true }]);
    let started!: Promise<void>;
    act(() => {
      started = flow.start(source);
      flow.close();
    });
    await act(() => started);
    expect(flow.pairing).toBeNull();
  });

  it("shows the paired phone under its new name", async () => {
    const source = commands([
      { devices: [phone("a")], hasPendingCode: true },
      { devices: [phone("a"), phone("b")], hasPendingCode: false },
    ]);
    await act(() => flow.start(source));
    await tick(2000);
    await act(async () => {
      await flow.rename("b", "Desk phone");
    });
    expect(source.renameDevice).toHaveBeenCalledWith("b", "Desk phone");
    expect(flow.outcome).toEqual({ kind: "paired", device: phone("b", "Desk phone") });
  });
});
