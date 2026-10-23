// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

function PopoverButton() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip content="Memory">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        brain
      </button>
    </Tooltip>
  );
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<PopoverButton />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

const trigger = () => host.querySelector("button")!.parentElement!;
const tooltip = () => document.querySelector('[role="tooltip"]');

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function hover() {
  act(() => {
    trigger().dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
  });
}

function leave() {
  act(() => {
    trigger().dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
  });
}

async function click() {
  act(() => host.querySelector("button")!.click());
  await flush();
}

describe("Tooltip over a button that opens a popover", () => {
  it("shows on hover", () => {
    hover();
    expect(tooltip()?.textContent).toBe("Memory");
  });

  it("goes away when the click opens the popover, and stays away on hover", async () => {
    hover();
    await click();
    expect(tooltip()).toBeNull();

    leave();
    hover();
    expect(tooltip()).toBeNull();
  });

  it("comes back only after the pointer leaves the closed trigger and returns", async () => {
    hover();
    await click();
    await click();
    expect(tooltip()).toBeNull();

    leave();
    hover();
    expect(tooltip()?.textContent).toBe("Memory");
  });
});
