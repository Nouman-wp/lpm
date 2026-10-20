// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeInvite } from "../peer/invite";

const mocks = vi.hoisted(() => ({
  store: { addProjectForPeer: vi.fn(), openSSHProject: vi.fn(), projects: [] as { name: string }[] },
  commands: {} as Record<string, ReturnType<typeof vi.fn>>,
  handlers: new Map<string, Set<(payload: unknown) => void>>(),
}));

vi.mock("../store/app", () => ({
  useAppStore: (select: (state: unknown) => unknown) => select(mocks.store),
}));
vi.mock("../../bridge/commands", () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, prop: string) =>
        prop === "then" ? undefined : (mocks.commands[prop] ??= vi.fn().mockResolvedValue(undefined)),
    },
  ),
);
vi.mock("../../bridge/runtime", () => ({
  BrowserOpenURL: vi.fn(),
  EventsOn: (name: string, cb: (payload: unknown) => void) => {
    const set = mocks.handlers.get(name) ?? new Set();
    set.add(cb);
    mocks.handlers.set(name, set);
    return () => set.delete(cb);
  },
}));

import { AnotherComputerScreen } from "./AnotherComputerScreen";

const HOST = { enabled: false, port: 8766, running: false, guestsOnly: false, hostId: "", pairing: null, devices: [], pairRequests: [] };
const OFFICE = { slug: "aaaa1111", alias: "Office PC", host: "10.0.0.2", port: 8766, hostId: "office", enabled: true, connected: true, platform: "windows" };
const STUDIO = { slug: "cccc3333", alias: "Studio Mac", host: "10.0.0.9", port: 8766, hostId: "studio", enabled: true, connected: false };
const NEARBY_STUDIO = { id: "studio", name: "Studio Mac", hosts: ["10.0.0.9"], port: 8766, dev: false };
const INVITE = encodeInvite({ hosts: ["10.0.0.9"], port: 8766, code: "K7Q2M9" });

let container: HTMLDivElement;
let root: Root;

function command(name: string) {
  return (mocks.commands[name] ??= vi.fn().mockResolvedValue(undefined));
}

async function flush() {
  await act(async () => {});
}

function emit(event: string, payload: unknown = undefined) {
  act(() => mocks.handlers.get(event)?.forEach((cb) => cb(payload)));
}

function peers(list: unknown[]) {
  command("PeerState").mockResolvedValue({ host: HOST, peers: list });
}

// Exact, so "Connect" doesn't match "Connect another computer".
function button(text: string, exact = true): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) =>
    exact ? b.textContent?.trim() === text : b.textContent?.includes(text),
  );
  if (!found) throw new Error(`no button "${text}"`);
  return found;
}

function type(text: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder^="Paste invite"]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  peers([OFFICE]);
  command("ReadClipboardText").mockResolvedValue("");
  command("GetVersion").mockResolvedValue("0.7.30");
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
  for (const k of Object.keys(mocks.commands)) delete mocks.commands[k];
  vi.clearAllMocks();
});

describe("AnotherComputerScreen", () => {
  it("is Settings → Connections", () => {
    const text = container.textContent;
    expect(text).toContain("Allow control of this");
    expect(text).toContain("Built-in Tailscale");
    expect(text).toContain("Same network");
    expect(text).toContain("Your computers");
    expect(text).toContain("Office PC");
    expect(text).not.toContain("Config sync");

    act(() => button("Office PC").click());

    expect(container.textContent).toContain("Open its projects here");
    expect(container.textContent).toContain("Config sync");
  });

  it("lists a computer paired both ways once", async () => {
    command("PeerState").mockResolvedValue({
      host: { ...HOST, devices: [{ id: "d1", name: "Office PC", hostId: "office" }, { id: "d2", name: "Air" }] },
      peers: [OFFICE],
    });
    emit("peer-state-changed");
    await flush();

    expect(container.textContent?.match(/Office PC/g)).toHaveLength(1);
    expect(container.textContent).toContain("Both ways");
    expect(container.textContent).toContain("Air");

    act(() => button("Office PC").click());
    act(() => button("Remove access").click());
    expect(document.body.textContent).toContain("Remove access for Office PC");
  });

  it("leaves Linux hosts to the Server screen", async () => {
    peers([OFFICE, { ...STUDIO, slug: "dddd4444", alias: "Build box", platform: "linux", headless: true }]);
    emit("peer-state-changed");
    await flush();

    const text = container.textContent;
    expect(text).not.toContain("Linux hosts you connect to");
    expect(text).not.toContain("Build box");
    expect(text).not.toContain("or to a Linux server");
  });

  it("goes on to adding a project on a computer added here once it's connected", async () => {
    command("PeerAdd").mockResolvedValue({ slug: STUDIO.slug });
    await act(async () => button("Add a", false).click());
    peers([OFFICE, STUDIO]);
    type(INVITE);
    await act(async () => button("Connect").click());
    await flush();
    emit("peer-state-changed");
    await flush();

    expect(command("PeerAdd")).toHaveBeenCalledWith(["10.0.0.9"], 8766, "K7Q2M9", "", undefined);
    expect(mocks.store.addProjectForPeer).not.toHaveBeenCalled();

    peers([OFFICE, { ...STUDIO, connected: true }]);
    emit("peer-state-changed");
    await flush();

    expect(mocks.store.addProjectForPeer).toHaveBeenCalledWith(STUDIO.slug, "Studio Mac", true);
  });

  it("leaves computers that were already there alone", async () => {
    peers([{ ...OFFICE, connected: false }]);
    emit("peer-state-changed");
    await flush();
    peers([OFFICE]);
    emit("peer-state-changed");
    await flush();

    expect(mocks.store.addProjectForPeer).not.toHaveBeenCalled();
  });

  it("withdraws a nearby request still waiting when the screen is left", async () => {
    command("PeerPairRequest").mockReturnValue(new Promise(() => {}));
    emit("peer-discovery", [NEARBY_STUDIO]);
    await act(async () => button("Connect").click());

    act(() => root.render(<></>));

    expect(command("PeerPairCancel")).toHaveBeenCalled();
  });
});
