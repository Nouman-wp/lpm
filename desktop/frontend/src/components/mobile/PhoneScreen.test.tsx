// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillApi, DrillScreen } from "../DrillMenu";

const mocks = vi.hoisted(() => ({
  commands: {} as Record<string, ReturnType<typeof vi.fn>>,
  store: { setSettingsTab: vi.fn(), setView: vi.fn() },
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
vi.mock("../../store/app", () => ({
  useAppStore: (select: (state: unknown) => unknown) => select(mocks.store),
}));

import { PhoneScreen } from "./PhoneScreen";

const PHONE = {
  id: "p1",
  name: "Work phone",
  phoneName: "iPhone",
  createdAt: 1,
  connected: true,
  route: "network",
  lastSeen: 2,
  lastRoute: "network",
};
const STUDIO = { slug: "cccc3333", alias: "Studio", host: "10.0.0.9", port: 8766, enabled: true, connected: true };
const PAIRING = { code: "AB12-CD34", url: "lpm://pair", svg: null, host: "100.64.0.2", hosts: ["100.64.0.2"], port: 8765 };

let container: HTMLDivElement;
let root: Root;
let pushed: DrillScreen[];
const drill: DrillApi = { push: (s) => pushed.push(s), pop: vi.fn(), close: vi.fn() };

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

async function mount(remote: Record<string, unknown>, peers: unknown[] = []) {
  command("RemoteState").mockResolvedValue({ enabled: true, running: true, port: 8765, tailscale: true, ...remote });
  command("PeerState").mockResolvedValue({ host: {}, peers });
  command("TailnetState").mockResolvedValue({ state: "running" });
  act(() => root.render(<PhoneScreen drill={drill} width="w-[400px]" />));
  await flush();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  pushed = [];
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
});

describe("PhoneScreen", () => {
  it("walks a first device through setup and opens its pairing code", async () => {
    await mount({ devices: [] });
    expect(container.textContent).toContain("Get lpm Link");
    command("RemoteStartPairing").mockResolvedValue(PAIRING);

    await act(async () => buttonWith("Pair a device").click());

    expect(command("RemoteStartPairing")).toHaveBeenCalledOnce();
    expect(pushed.map((s) => s.title)).toEqual(["Pair a device"]);
  });

  it("lists paired devices and pairs the next one with a connected machine", async () => {
    await mount({ devices: [PHONE] }, [STUDIO]);
    expect(container.textContent).toContain("Work phone");
    expect(container.textContent).toContain("Connected now");
    expect(container.textContent).toContain("Pair a device with");
    command("PeerRemotePair").mockResolvedValue(PAIRING);

    await act(async () => buttonWith("Studio").click());

    expect(command("PeerRemotePair")).toHaveBeenCalledWith("cccc3333");
    expect(pushed.map((s) => s.title)).toEqual(["Pair with Studio"]);
  });

  it("stays put and says why when no code comes back", async () => {
    await mount({ devices: [PHONE] });
    command("RemoteStartPairing").mockRejectedValue("port 8765 is in use");

    await act(async () => buttonWith("This").click());

    expect(container.textContent).toContain("Couldn't start pairing. Port 8765 is in use.");
    expect(pushed).toEqual([]);
  });

  it("turns remote control back on when paired devices can't connect", async () => {
    await mount({ devices: [PHONE], enabled: false, running: false });
    command("RemoteSetConfig").mockResolvedValue({ enabled: true, running: true, devices: [PHONE] });

    await act(async () => buttonWith("Turn on").click());

    expect(command("RemoteSetConfig")).toHaveBeenCalledWith(true, 8765, true);
    expect(container.textContent).not.toContain("Remote control is off");
  });

  it("leaves renaming and removing to Settings", async () => {
    await mount({ devices: [PHONE] });

    await act(async () => buttonWith("Manage devices").click());

    expect(drill.close).toHaveBeenCalledOnce();
    expect(mocks.store.setSettingsTab).toHaveBeenCalledWith("mobile");
    expect(mocks.store.setView).toHaveBeenCalledWith("settings");
  });
});
