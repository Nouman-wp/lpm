// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionPicker } from "./ActionPicker";
import { primaryStorageKey } from "./splitPrimary";
import type { ActionInfo } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const leaf = (name: string, label: string): ActionInfo => ({
  name,
  label,
  cmd: "claude",
  confirm: false,
  display: "header",
  type: "terminal",
});

const ACTIONS: ActionInfo[] = [
  {
    name: "claude-max",
    label: "claude-max",
    cmd: "",
    confirm: false,
    display: "header",
    primary: "last-used",
    children: [leaf("claude-max:claude", "Claude"), leaf("claude-max:ultracode", "Ultracode")],
  },
];

let host: HTMLDivElement;
let root: Root;

const buttons = () => [...document.body.querySelectorAll("button")];

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("ActionPicker", () => {
  it("shows a split menu as its last-used child, the way the header does", () => {
    localStorage.setItem(primaryStorageKey("app", "claude-max"), "ultracode");
    const onChange = vi.fn();
    act(() =>
      root.render(<ActionPicker actions={ACTIONS} value="" onChange={onChange} scope="app" />),
    );
    act(() => buttons()[0].click());
    const row = buttons().find((b) => b.textContent === "Ultracode");
    expect(row).toBeDefined();
    expect(buttons().some((b) => b.textContent === "claude-max")).toBe(false);
    act(() => row!.click());
    expect(onChange).toHaveBeenCalledWith("claude-max:ultracode");
  });
});
