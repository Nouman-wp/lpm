// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunKindPicker } from "./RunKindPicker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const tile = (title: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(title))!;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("RunKindPicker", () => {
  it("marks the picked kind and reports a new pick", () => {
    const onChange = vi.fn();
    act(() => root.render(<RunKindPicker value="prompt" onChange={onChange} actionsAvailable />));
    expect(tile("AI prompt").getAttribute("aria-pressed")).toBe("true");
    act(() => tile("Command").click());
    expect(onChange).toHaveBeenCalledWith("cmd");
  });

  it("holds Action back until the job runs in exactly one project", () => {
    act(() => root.render(<RunKindPicker value="cmd" onChange={() => {}} actionsAvailable={false} />));
    expect(tile("Action").disabled).toBe(true);
    expect(tile("Action").textContent).toContain("Needs exactly one project");
  });
});
