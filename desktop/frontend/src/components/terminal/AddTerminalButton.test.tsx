// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../../store/settings";
import { AddTerminalButton } from "./AddTerminalButton";

let host: HTMLDivElement;
let root: Root;
const update = useSettingsStore.getState().update;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  useSettingsStore.setState({ pickAgentOnNewTab: false, update });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(props: Partial<Parameters<typeof AddTerminalButton>[0]> = {}) {
  const handlers = {
    onAddTerminal: vi.fn(),
    onRunCommand: vi.fn(),
    onOpenAgent: vi.fn(),
    onResumeSession: vi.fn(),
    onOpenRequestHandled: vi.fn(),
  };
  act(() =>
    root.render(<AddTerminalButton openRequested={false} {...handlers} {...props} />),
  );
  return handlers;
}

const plus = () => host.querySelector<HTMLButtonElement>('button[aria-label="New terminal"]')!;
const popup = () => document.querySelector('[role="dialog"][aria-label="New tab"]');
const prompt = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Task or command"]')!;
const cursorRow = () => document.querySelector('[aria-current="true"]')?.textContent ?? "";
const row = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("[data-new-tab-popup] button")).find(
    (b) => b.textContent?.includes(label),
  )!;
const chip = (agent: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label^="${agent} model and level"]`)!;
const pill = (group: "Model" | "Level", label: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(`[role="radiogroup"][aria-label="${group}"] button`),
  ).find((b) => b.textContent === label)!;

function rightClick(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
}

function typeInto(el: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function press(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("AddTerminalButton", () => {
  it("opens a terminal on a click", () => {
    const h = render();
    act(() => plus().click());
    expect(h.onAddTerminal).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it("opens the popup on right-click and sends what was typed to the agent under the cursor", () => {
    const h = render();
    rightClick(plus());
    expect(popup()).not.toBeNull();
    expect(document.activeElement).toBe(prompt());
    expect(cursorRow()).toContain("Claude Code");

    typeInto(prompt(), "fix the flaky test");
    expect(cursorRow()).toContain("Starts with “fix the flaky test”");
    press(prompt(), "Enter");
    expect(h.onOpenAgent).toHaveBeenCalledWith({
      agent: "claude",
      model: "",
      effort: "",
      prompt: "fix the flaky test",
    });
    expect(popup()).toBeNull();
    expect(h.onAddTerminal).not.toHaveBeenCalled();
  });

  it("runs what was typed in a terminal picked with the arrow keys, and starts there next time", () => {
    const h = render();
    rightClick(plus());
    typeInto(prompt(), "npm test");
    for (let i = 0; i < 4; i++) press(prompt(), "ArrowDown");
    expect(cursorRow()).toContain("Run in a new terminal");
    expect(cursorRow()).toContain("$ npm test");

    press(prompt(), "Enter");
    expect(h.onRunCommand).toHaveBeenCalledWith("npm test");
    expect(h.onOpenAgent).not.toHaveBeenCalled();
    expect(popup()).toBeNull();

    rightClick(plus());
    expect(cursorRow()).toContain("New terminal");
    press(prompt(), "Enter");
    expect(h.onAddTerminal).toHaveBeenCalledTimes(1);
  });

  it("picks each agent's model and level under its row, and remembers them", () => {
    const h = render();
    rightClick(plus());
    act(() => chip("Codex").click());
    act(() => pill("Model", "GPT-6.1 Sol").click());
    act(() => pill("Level", "Ultra").click());
    expect(chip("Codex").textContent).toContain("GPT-6.1 Sol · Ultra");
    expect(chip("Claude Code").textContent).toContain("Default model");

    act(() => row("Codex").click());
    expect(h.onOpenAgent).toHaveBeenCalledWith({
      agent: "codex",
      model: "gpt-6.1-sol",
      effort: "ultra",
      prompt: undefined,
    });

    rightClick(plus());
    expect(cursorRow()).toContain("Codex");
    expect(chip("Codex").textContent).toContain("GPT-6.1 Sol · Ultra");
  });

  it("folds the picker on Escape before closing", () => {
    render();
    rightClick(plus());
    act(() => chip("Codex").click());
    expect(document.querySelector('[aria-label="Model"]')).not.toBeNull();

    press(prompt(), "Escape");
    expect(document.querySelector('[aria-label="Model"]')).toBeNull();
    expect(popup()).not.toBeNull();

    press(prompt(), "Escape");
    expect(popup()).toBeNull();
  });

  it("asks what to open on a click once + opens the menu", () => {
    useSettingsStore.setState({ pickAgentOnNewTab: true });
    const h = render();
    act(() => plus().click());
    expect(popup()).not.toBeNull();
    expect(h.onAddTerminal).not.toHaveBeenCalled();

    act(() => row("New terminal").click());
    expect(h.onAddTerminal).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it("sets what + opens from the footer", () => {
    const setSettings = vi.fn(async () => {});
    useSettingsStore.setState({ update: setSettings });
    render();
    rightClick(plus());
    const footer = document.querySelector('[aria-label="Clicking + opens"]')!;
    act(() =>
      Array.from(footer.querySelectorAll("button"))
        .find((b) => b.textContent === "Menu")!
        .click(),
    );
    expect(setSettings).toHaveBeenCalledWith({ pickAgentOnNewTab: true });
  });

  it("opens when ⌘T asks, and says so", () => {
    const h = render({ openRequested: true });
    expect(popup()).not.toBeNull();
    expect(h.onOpenRequestHandled).toHaveBeenCalledTimes(1);
  });

  it("hands Resume a past session on and closes", () => {
    const h = render();
    rightClick(plus());
    act(() => row("Resume a past session").click());
    expect(h.onResumeSession).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });
});
