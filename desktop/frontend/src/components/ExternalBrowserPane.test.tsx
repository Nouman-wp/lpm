// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const open = vi.hoisted(() => vi.fn());
const forward = vi.hoisted(() => vi.fn(async () => 4123));
vi.mock("../../bridge/runtime", () => ({ BrowserOpenURL: open }));
vi.mock("../../bridge/commands", () => ({ PeerPortForward: forward }));

import { ExternalBrowserPane } from "./ExternalBrowserPane";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  open.mockClear();
  render("web");
});

function render(projectName: string) {
  act(() => root.render(<ExternalBrowserPane id="b1" projectName={projectName} projectLabel={projectName} active />));
}

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function submit(value: string) {
  const input = host.querySelector("input")!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("ExternalBrowserPane", () => {
  it("opens the address in the system browser", async () => {
    await submit("localhost:3000");
    expect(open).toHaveBeenCalledWith("http://localhost:3000");
    expect(host.textContent).toContain("Opened localhost");
  });

  it("turns free text into a search", async () => {
    await submit("tauri docs");
    expect(open).toHaveBeenCalledWith("https://www.google.com/search?q=tauri%20docs");
  });

  it("opens nothing for an empty address", async () => {
    await submit("   ");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a paired machine's localhost through a port tunnelled from it", async () => {
    render("peer-aaaaaaaa-web");
    await submit("localhost:3000/admin");
    expect(forward).toHaveBeenCalledWith("aaaaaaaa", 3000);
    expect(open).toHaveBeenCalledWith("http://localhost:4123/admin");
  });
});
