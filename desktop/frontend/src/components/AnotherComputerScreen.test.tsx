// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeInvite } from "../peer/invite";

const mocks = vi.hoisted(() => ({
  store: { addProjectForPeer: vi.fn(), projects: [] as { name: string }[] },
  commands: {
    PeerState: vi.fn(),
    PeerAdd: vi.fn(),
    PeerPairRequest: vi.fn(),
    PeerPairCancel: vi.fn(),
    PeerDiscoveryStart: vi.fn(),
    PeerDiscoveryStop: vi.fn(),
    ReadClipboardText: vi.fn(),
  },
  handlers: new Map<string, (payload: unknown) => void>(),
}));

vi.mock("../store/app", () => ({
  useAppStore: (select: (state: unknown) => unknown) => select(mocks.store),
}));
vi.mock("../store/tabShares", () => ({
  useTabShares: { getState: () => ({ openJoinDialog: vi.fn() }) },
}));
vi.mock("../../bridge/commands", () => mocks.commands);
vi.mock("../../bridge/runtime", () => ({
  EventsOn: (name: string, cb: (payload: unknown) => void) => {
    mocks.handlers.set(name, cb);
    return () => mocks.handlers.delete(name);
  },
}));

import { AnotherComputerScreen } from "./AnotherComputerScreen";

const HOST = { enabled: false, port: 8766, running: false, guestsOnly: false, hostId: "", pairing: null, devices: [], pairRequests: [] };
const OFFICE = { slug: "aaaa1111", alias: "Office PC", host: "10.0.0.2", port: 8766, hostId: "office", enabled: true, connected: true, platform: "windows" };
const IMAC = { slug: "bbbb2222", alias: "Home iMac", host: "10.0.0.3", port: 8766, hostId: "imac", enabled: true, connected: false };
const STUDIO = { slug: "cccc3333", alias: "Studio Mac", host: "10.0.0.9", port: 8766, hostId: "studio", enabled: true, connected: true };
const NEARBY_STUDIO = { id: "studio", name: "Studio Mac", hosts: ["10.0.0.9"], port: 8766, dev: false };
const INVITE = encodeInvite({ hosts: ["10.0.0.9"], port: 8766, code: "K7Q2M9" });

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {});
}

function emit(event: string, payload: unknown) {
  act(() => mocks.handlers.get(event)?.(payload));
}

function buttonWith(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`no button with "${text}"`);
  return found;
}

// The first button reading exactly "Connect": a paired row's "Connected" status
// would match a looser search.
function connectButton(): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Connect");
  if (!found) throw new Error("no Connect button");
  return found;
}

function type(text: string) {
  const input = container.querySelector("input")!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(button: HTMLButtonElement) {
  await act(async () => button.click());
}

beforeEach(async () => {
  mocks.store.projects = [{ name: "peer-aaaa1111-web" }, { name: "peer-aaaa1111-api" }, { name: "local-app" }];
  mocks.commands.PeerState.mockResolvedValue({ host: HOST, peers: [OFFICE, IMAC] });
  mocks.commands.ReadClipboardText.mockResolvedValue("");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<AnotherComputerScreen />));
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mocks.handlers.clear();
  vi.clearAllMocks();
});

describe("AnotherComputerScreen", () => {
  it("opens the picker on a computer it already pairs with", async () => {
    expect(container.textContent).toContain("Connected · 2 projects");
    expect(buttonWith("Home iMac").disabled).toBe(true);

    await click(buttonWith("Office PC"));

    expect(mocks.store.addProjectForPeer).toHaveBeenCalledWith("aaaa1111", "Office PC");
  });

  it("pairs from a pasted invite, then opens the picker on that computer", async () => {
    mocks.commands.PeerAdd.mockResolvedValue({ slug: "cccc3333" });
    mocks.commands.PeerState.mockResolvedValue({ host: HOST, peers: [OFFICE, IMAC, STUDIO] });

    type(INVITE);
    await click(connectButton());
    await flush();

    expect(mocks.commands.PeerAdd).toHaveBeenCalledWith(["10.0.0.9"], 8766, "K7Q2M9", "", undefined);
    expect(mocks.store.addProjectForPeer).toHaveBeenCalledWith("cccc3333", "Studio Mac", true);
  });

  it("says why and stays put when pairing fails", async () => {
    mocks.commands.PeerAdd.mockRejectedValue("pairing code expired");

    type(INVITE);
    await click(connectButton());

    expect(container.textContent).toContain("pairing code expired");
    expect(mocks.store.addProjectForPeer).not.toHaveBeenCalled();
  });

  it("asks a nearby computer, shows the number to compare, and opens it once accepted", async () => {
    let accept: (v: { slug: string }) => void = () => {};
    mocks.commands.PeerPairRequest.mockReturnValue(new Promise((resolve) => (accept = resolve)));
    emit("peer-discovery", [NEARBY_STUDIO]);

    await click(connectButton());
    emit("peer-pair-pending", { sas: "482913" });

    expect(mocks.commands.PeerPairRequest).toHaveBeenCalledWith(["10.0.0.9"], 8766);
    expect(container.textContent).toContain("482 913");

    mocks.commands.PeerState.mockResolvedValue({ host: HOST, peers: [OFFICE, IMAC, STUDIO] });
    await act(async () => accept({ slug: "cccc3333" }));
    await flush();

    expect(mocks.store.addProjectForPeer).toHaveBeenCalledWith("cccc3333", "Studio Mac", true);
  });

  it("withdraws a waiting request when the screen is left", async () => {
    mocks.commands.PeerPairRequest.mockReturnValue(new Promise(() => {}));
    emit("peer-discovery", [NEARBY_STUDIO]);
    await click(connectButton());

    act(() => root.render(<></>));

    expect(mocks.commands.PeerPairCancel).toHaveBeenCalled();
    expect(mocks.store.addProjectForPeer).not.toHaveBeenCalled();
  });

  it("offers an invite already in the clipboard", async () => {
    act(() => root.unmount());
    mocks.commands.ReadClipboardText.mockResolvedValue(INVITE);
    mocks.commands.PeerAdd.mockResolvedValue({ slug: "cccc3333" });
    root = createRoot(container);
    act(() => root.render(<AnotherComputerScreen />));
    await flush();

    expect(container.textContent).toContain("Invite found in your clipboard");
    mocks.commands.PeerState.mockResolvedValue({ host: HOST, peers: [OFFICE, IMAC, STUDIO] });
    await click(connectButton());
    await flush();

    expect(mocks.commands.PeerAdd).toHaveBeenCalledWith(["10.0.0.9"], 8766, "K7Q2M9", "", undefined);
    expect(mocks.store.addProjectForPeer).toHaveBeenCalledWith("cccc3333", "Studio Mac", true);
  });
});
