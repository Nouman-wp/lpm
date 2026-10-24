// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PairingModal, type Pairing } from "./PairingModal";
import { MACHINE } from "../machineWords";
import type { PhoneDevice } from "../mobile/phoneStatus";

const pairing = (hosts: string[], expiresAt?: number): Pairing => ({
  code: "AB12-CD34",
  url: "lpm://pair",
  svg: "<svg></svg>",
  host: hosts[0],
  hosts,
  port: 8765,
  expiresAt,
});

const anywhere = ["192.168.1.20", "100.64.0.12"];

const phone: PhoneDevice = {
  id: "d1",
  name: "Ada's iPhone",
  phoneName: "iPhone",
  createdAt: 0,
  connected: true,
  route: "network",
  lastSeen: 0,
  lastRoute: null,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
}

describe("PairingModal", () => {
  it("holds back a code that only works on this network until the user agrees", async () => {
    act(() => root.render(<PairingModal pairing={pairing(["192.168.1.20"])} onClose={() => {}} />));
    expect(document.body.textContent).toContain("This code won't work away from home");
    expect(document.body.textContent).not.toContain("AB12-CD34");
    await act(async () => button("Pair for this network only")!.click());
    expect(document.body.textContent).toContain("AB12-CD34");
  });

  it("shows a code that works from anywhere straight away", () => {
    act(() => root.render(<PairingModal pairing={pairing(["192.168.1.20", "100.64.0.12"])} onClose={() => {}} />));
    expect(document.body.textContent).toContain("AB12-CD34");
    expect(document.body.textContent).not.toContain("This code won't work away from home");
  });

  it("offers setting up Tailscale instead", async () => {
    const setUp = vi.fn();
    act(() =>
      root.render(<PairingModal pairing={pairing(["192.168.1.20"])} onClose={() => {}} onSetUpTailscale={setUp} />),
    );
    await act(async () => button("Set up Tailscale")!.click());
    expect(setUp).toHaveBeenCalledOnce();
  });

  it("counts down to when the code stops working", () => {
    act(() => root.render(<PairingModal pairing={pairing(anywhere, Date.now() + 582_000)} onClose={() => {}} />));
    expect(document.body.textContent).toContain("Waiting for your phone… 9:42 left");
  });

  it("offers Cancel while a followed code waits, and Done when nothing follows it", () => {
    act(() =>
      root.render(<PairingModal pairing={pairing(anywhere)} outcome={{ kind: "waiting" }} onClose={() => {}} />),
    );
    expect(button("Cancel")).toBeDefined();
    act(() => root.render(<PairingModal pairing={pairing(anywhere)} onClose={() => {}} />));
    expect(button("Cancel")).toBeUndefined();
    expect(button("Done")).toBeDefined();
  });

  it("copies the code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    act(() => root.render(<PairingModal pairing={pairing(anywhere)} onClose={() => {}} />));
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Copy code"]')!.click());
    expect(writeText).toHaveBeenCalledWith("AB12-CD34");
  });

  it("shows the phone that used the code", async () => {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <PairingModal
          pairing={pairing(anywhere)}
          outcome={{ kind: "paired", device: phone }}
          onClose={onClose}
          onRename={() => {}}
        />,
      ),
    );
    expect(document.body.textContent).toContain("Ada's iPhone paired");
    expect(document.body.textContent).toContain(`It can now see and control ${MACHINE.thisMachine}.`);
    expect(document.body.textContent).not.toContain("AB12-CD34");
    expect(button("Rename")).toBeDefined();
    await act(async () => button("Done")!.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("offers a new code once the code expires", async () => {
    const onNewCode = vi.fn();
    act(() =>
      root.render(
        <PairingModal
          pairing={pairing(anywhere, Date.now() - 1)}
          outcome={{ kind: "waiting" }}
          onClose={() => {}}
          onNewCode={onNewCode}
        />,
      ),
    );
    expect(document.body.textContent).toContain("Code expired");
    expect(document.body.textContent).toContain("Codes last 10 minutes and work once.");
    await act(async () => button("New code")!.click());
    expect(onNewCode).toHaveBeenCalledOnce();
  });

  it("treats a code its machine no longer holds as expired", () => {
    act(() =>
      root.render(<PairingModal pairing={pairing(anywhere)} outcome={{ kind: "withdrawn" }} onClose={() => {}} />),
    );
    expect(document.body.textContent).toContain("Code expired");
    expect(button("Done")).toBeDefined();
  });
});
