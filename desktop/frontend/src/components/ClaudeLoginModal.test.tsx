// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaudeLoginStatus } from "../claudeLoginStatus";

vi.mock("../../bridge/commands", () => ({ StopTerminal: vi.fn(() => Promise.resolve()) }));
vi.mock("./InteractivePane", () => ({ InteractivePane: () => null }));

import { ClaudeLoginModal } from "./ClaudeLoginModal";

const WAITING: ClaudeLoginStatus = { signedIn: false, email: "", planLabel: "" };
const SIGNED_IN: ClaudeLoginStatus = { signedIn: true, email: "ada@example.com", planLabel: "Max 20x" };
const account = { id: "work", label: "Work" };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(status: ClaudeLoginStatus, refresh = vi.fn(() => Promise.resolve()), onClose = vi.fn()) {
  act(() =>
    root.render(
      <ClaudeLoginModal
        account={account}
        startLogin={() => new Promise(() => {})}
        status={status}
        refresh={refresh}
        onClose={onClose}
      />,
    ),
  );
  return { refresh, onClose };
}

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
}

function pressEscape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

describe("ClaudeLoginModal", () => {
  it("waits for the browser, reading the account every two seconds", () => {
    const { refresh } = render(WAITING);
    expect(document.body.textContent).toContain("Waiting for the browser…");
    expect(document.body.textContent).toContain("Finish in your browser. If it asks for a code, paste it below.");
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(4000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("closes only through Cancel while waiting", () => {
    const { onClose } = render(WAITING);
    pressEscape();
    act(() => (document.querySelector("[data-modal-overlay] > div") as HTMLElement).click());
    expect(onClose).not.toHaveBeenCalled();
    act(() => button("Cancel")!.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("confirms the sign-in, refreshes the accounts at once and stops polling", () => {
    const refresh = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    render(WAITING, refresh, onClose);
    render(SIGNED_IN, refresh, onClose);
    expect(document.body.textContent).toContain("Signed in as ada@example.com · Max 20x");
    expect(refresh).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(6000));
    expect(refresh).toHaveBeenCalledOnce();
    expect(button("Cancel")).toBeUndefined();
    pressEscape();
    expect(onClose).toHaveBeenCalledOnce();
    act(() => button("Done")!.click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
