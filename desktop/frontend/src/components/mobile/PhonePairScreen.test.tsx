// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pairing } from "../PairingCode";

const mocks = vi.hoisted(() => ({
  commands: {} as Record<string, ReturnType<typeof vi.fn>>,
  handlers: new Map<string, () => void>(),
}));

vi.mock("../../../bridge/commands", () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, prop: string) => (prop === "then" ? undefined : (mocks.commands[prop] ??= vi.fn())),
    },
  ),
);
vi.mock("../../../bridge/runtime", () => ({
  BrowserOpenURL: vi.fn(),
  EventsOn: (name: string, cb: () => void) => {
    mocks.handlers.set(name, cb);
    return () => mocks.handlers.delete(name);
  },
}));

import { PhonePairScreen, type PairMachine } from "./PhonePairScreen";

const OLD = { id: "p1", name: "", phoneName: "iPhone", createdAt: 1, connected: false, route: null, lastSeen: 0, lastRoute: null };
const NEW = { ...OLD, id: "p2", phoneName: "iPad Pro", connected: true, route: "network" };

const code = (c: string, hosts = ["192.168.1.20", "100.64.0.2"]): Pairing => ({
  code: c,
  url: "lpm://pair",
  svg: null,
  host: hosts[0],
  hosts,
  port: 8765,
});

let container: HTMLDivElement;
let root: Root;
const onBack = vi.fn();
const onDone = vi.fn();

function command(name: string) {
  return (mocks.commands[name] ??= vi.fn());
}

async function flush() {
  await act(async () => {});
}

function buttonWith(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`no button with "${text}"`);
  return found;
}

async function mount(initial: Pairing, mint = vi.fn(), machine?: PairMachine) {
  command("TailnetState").mockResolvedValue({ state: "running" });
  act(() =>
    root.render(<PhonePairScreen initial={initial} mint={mint} machine={machine} onBack={onBack} onDone={onDone} />),
  );
  await flush();
}

function remote(state: Record<string, unknown>) {
  command("RemoteState").mockResolvedValue({ enabled: true, running: true, hasPendingCode: true, ...state });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mocks.handlers.clear();
  for (const k of Object.keys(mocks.commands)) delete mocks.commands[k];
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("PhonePairScreen", () => {
  it("shows the code, then the device that used it", async () => {
    remote({ devices: [OLD] });
    await mount(code("AB12-CD34"));
    expect(container.textContent).toContain("AB12-CD34");
    expect(container.textContent).toContain("Waiting for your device");

    remote({ devices: [OLD, NEW], hasPendingCode: false });
    await act(async () => mocks.handlers.get("remote-devices-changed")?.());

    expect(container.textContent).toContain("iPad Pro is paired");
    await act(async () => buttonWith("Done").click());
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("holds back a code for this network only and offers Tailscale instead", async () => {
    remote({ devices: [] });
    command("TailnetSignIn").mockResolvedValue({ state: "starting" });
    await mount(code("AB12-CD34", ["192.168.1.20"]));
    expect(container.textContent).toContain("This code won't work away from home");
    expect(container.textContent).not.toContain("AB12-CD34");

    await act(async () => buttonWith("Set up Tailscale").click());

    expect(command("TailnetSignIn")).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("makes a new code once this one lapses", async () => {
    remote({ devices: [], hasPendingCode: false });
    const mint = vi.fn().mockResolvedValue(code("ZZ99-YY88"));
    await mount(code("AB12-CD34"), mint);
    expect(container.textContent).toContain("This code can't be used any more");

    remote({ devices: [] });
    await act(async () => buttonWith("New code").click());

    expect(mint).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("ZZ99-YY88");
  });

  it("watches a connected machine for the device it pairs", async () => {
    vi.useFakeTimers();
    command("PeerInvoke").mockResolvedValue({ hasPendingCode: true, devices: [] });
    await mount(code("AB12-CD34"), vi.fn(), { slug: "cccc3333", name: "Studio" });
    expect(command("PeerInvoke")).toHaveBeenCalledWith("cccc3333", "remote_state", {});
    expect(command("RemoteState")).not.toHaveBeenCalled();

    command("PeerInvoke").mockResolvedValue({ hasPendingCode: false, devices: [NEW] });
    await act(async () => vi.advanceTimersByTime(2000));
    await flush();

    expect(container.textContent).toContain("iPad Pro is paired");
    expect(container.textContent).toContain("It connects straight to Studio");
  });
});
