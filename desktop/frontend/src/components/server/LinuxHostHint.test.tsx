// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LinuxHostHint } from "./LinuxHostHint";

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

describe("LinuxHostHint", () => {
  it("offers setting the server up as a Linux host", () => {
    const onSetUp = vi.fn();
    act(() => root.render(<LinuxHostHint onSetUp={onSetUp} />));

    expect(container.textContent).toContain("Keeping several projects on this server?");
    act(() => container.querySelector("button")!.click());
    expect(onSetUp).toHaveBeenCalledOnce();
  });

  it("stays out of the way while the form is busy", () => {
    const onSetUp = vi.fn();
    act(() => root.render(<LinuxHostHint disabled onSetUp={onSetUp} />));

    expect(container.querySelector("button")!.disabled).toBe(true);
  });
});
