// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../../store/settings";
import { AddTerminalButton } from "./AddTerminalButton";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  useSettingsStore.setState({ pickAgentOnNewTab: false });
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
const prompt = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="First prompt"]')!;
const chip = () => document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
const button = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim().startsWith(text),
  )!;
const row = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')).find(
    (b) => b.textContent?.trim().endsWith(label),
  )!;

function rightClick(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
}

function hover(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  });
}

function typeInto(el: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(el: Element) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}

describe("AddTerminalButton", () => {
  it("opens a terminal on a click", () => {
    const h = render();
    act(() => plus().click());
    expect(h.onAddTerminal).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it("opens the popup on right-click, with the prompt taking the keyboard", () => {
    const h = render();
    rightClick(plus());
    expect(popup()).not.toBeNull();
    expect(document.activeElement).toBe(prompt());

    typeInto(prompt(), "fix the flaky test");
    pressEnter(prompt());
    expect(h.onOpenAgent).toHaveBeenCalledWith({
      agent: "claude",
      model: "",
      effort: "",
      prompt: "fix the flaky test",
    });
    expect(popup()).toBeNull();
    expect(h.onAddTerminal).not.toHaveBeenCalled();
  });

  it("picks agent, model and level from the chip's cascade, and remembers it", () => {
    const h = render();
    rightClick(plus());
    act(() => chip().click());
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    hover(row("Codex"));
    hover(row("GPT-6.1 Sol"));
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
        .find((b) => b.textContent?.startsWith("Ultra"))!
        .click(),
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(chip().textContent).toContain("Codex · GPT-6.1 Sol · Ultra");

    act(() => button("Open").click());
    expect(h.onOpenAgent).toHaveBeenCalledWith({
      agent: "codex",
      model: "gpt-6.1-sol",
      effort: "ultra",
      prompt: undefined,
    });

    rightClick(plus());
    expect(chip().textContent).toContain("Codex · GPT-6.1 Sol · Ultra");
  });

  it("asks what to open on a click once the switch is on", () => {
    useSettingsStore.setState({ pickAgentOnNewTab: true });
    const h = render();
    act(() => plus().click());
    expect(popup()).not.toBeNull();
    expect(h.onAddTerminal).not.toHaveBeenCalled();

    act(() => button("New terminal").click());
    expect(h.onAddTerminal).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it("opens when ⌘T asks, and says so", () => {
    const h = render({ openRequested: true });
    expect(popup()).not.toBeNull();
    expect(h.onOpenRequestHandled).toHaveBeenCalledTimes(1);
  });

  it("hands Resume a past session on and closes", () => {
    const h = render();
    rightClick(plus());
    act(() => button("Resume a past session").click());
    expect(h.onResumeSession).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });
});
