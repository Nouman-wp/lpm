// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commands: {} as Record<string, ReturnType<typeof vi.fn>>,
  store: {
    addProjectPickerOpen: true,
    closeAddProjectPicker: vi.fn(),
    pickAddProjectKind: vi.fn(),
    addProjectTarget: null,
    addProjectStart: null,
    addProjectForPeer: vi.fn(),
    projects: [],
  },
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
vi.mock("../../../bridge/runtime", () => ({ BrowserOpenURL: vi.fn(), EventsOn: () => () => {} }));
vi.mock("../../store/app", () => ({
  useAppStore: (select: (state: unknown) => unknown) => select(mocks.store),
}));

import { NewProjectPicker } from "../NewProjectPicker";

const PHONE = {
  id: "p1",
  name: "",
  phoneName: "iPhone 18 Pro",
  createdAt: 1,
  connected: false,
  route: null,
  lastSeen: 2,
  lastRoute: "network",
};
const STUDIO = { slug: "cccc3333", alias: "Studio", host: "10.0.0.9", port: 8766, enabled: true, connected: true };
const PAIRING = { code: "AB12-CD34", url: "lpm://pair", svg: null, host: "100.64.0.2", hosts: ["100.64.0.2"], port: 8769 };

let container: HTMLDivElement;
let root: Root;

function command(name: string) {
  return (mocks.commands[name] ??= vi.fn());
}

async function flush() {
  await act(async () => {});
}

function button(text: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`no button with "${text}"`);
  return found;
}

async function openPhone(peers: unknown[] = []) {
  command("RemoteState").mockResolvedValue({ enabled: true, running: true, port: 8769, tailscale: true, hasPendingCode: true, devices: [PHONE] });
  command("PeerState").mockResolvedValue({ host: {}, peers });
  command("TailnetState").mockResolvedValue({ state: "running", ips: ["100.64.0.2"] });
  act(() => root.render(<NewProjectPicker />));
  await flush();
  await act(async () => button("Phone").click());
  await flush();
}

function escape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
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
  for (const k of Object.keys(mocks.commands)) delete mocks.commands[k];
  vi.clearAllMocks();
});

describe("Add a project → Phone", () => {
  it("shows Settings → Mobile devices for this machine", async () => {
    await openPhone();

    const text = document.body.textContent;
    expect(text).toContain("Remote control");
    expect(text).toContain("Built-in Tailscale");
    expect(text).toContain("Same network");
    expect(text).toContain("Your devices");
    expect(text).toContain("iPhone 18 Pro");
    expect(button("Pair a device")).toBeDefined();
  });

  it("shows the pairing code over the picker, and Escape closes only the code", async () => {
    await openPhone();
    command("RemoteStartPairing").mockResolvedValue(PAIRING);

    await act(async () => button("Pair a device").click());
    await flush();
    expect(document.body.textContent).toContain("AB12-CD34");

    escape();

    expect(document.body.textContent).not.toContain("AB12-CD34");
    expect(document.body.textContent).toContain("Remote control");
    expect(mocks.store.closeAddProjectPicker).not.toHaveBeenCalled();
  });

  it("asks which machine to pair with when others are connected, and Escape closes only that menu", async () => {
    await openPhone([STUDIO]);

    await act(async () => button("Pair a device").click());
    expect(document.querySelector("[data-context-menu]")?.textContent).toContain("Studio");

    escape();

    expect(document.querySelector("[data-context-menu]")).toBeNull();
    expect(document.body.textContent).toContain("Remote control");
  });

  it("goes back to the list on Escape when nothing is open over it", async () => {
    await openPhone();

    escape();

    expect(document.body.textContent).toContain("Add a project");
    expect(document.body.textContent).not.toContain("Remote control");
  });
});
