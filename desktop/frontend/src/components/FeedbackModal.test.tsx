// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("../../bridge/commands", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  GetVersion: () => Promise.resolve("0.7.32"),
  GetPlatform: () => Promise.resolve("darwin/arm64"),
}));
vi.mock("../../bridge/runtime", () => ({
  BrowserOpenURL: bridge.open,
  EventsOn: () => () => {},
  EventsEmit: vi.fn(),
}));

import { FeedbackModal } from "./FeedbackModal";
import { useAppStore } from "../store/app";

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  bridge.open.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  useAppStore.setState({ feedbackOpen: true });
  await act(async () => root.render(<FeedbackModal />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  useAppStore.setState({ feedbackOpen: false });
});

const box = () => document.querySelector<HTMLTextAreaElement>("#feedback-text")!;
const chip = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find(
    (b) => b.textContent === name,
  )!;
const pressed = () =>
  [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']")].map(
    (b) => b.textContent,
  );
const submit = () => document.querySelector<HTMLButtonElement>("button[type='submit']")!;

function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(box(), value);
    box().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("FeedbackModal", () => {
  it("opens on one empty box with nothing guessed", () => {
    expect(box()).not.toBeNull();
    expect(pressed()).toEqual([]);
    expect(submit().disabled).toBe(true);
  });

  it("guesses the type from the text and shows the title", () => {
    type("The terminal crashes when I paste a long line. It happens every time.");
    expect(pressed()).toEqual(["Bug"]);
    expect(document.body.textContent).toContain("Title: The terminal crashes when I paste a long line");
    expect(submit().disabled).toBe(false);

    type("How do I run two agents on one project?");
    expect(pressed()).toEqual(["Question"]);
  });

  it("keeps the type the user picked as the text changes", () => {
    type("The terminal crashes when I paste a long line");
    act(() => chip("Idea").click());
    type("The terminal crashes when I paste a long line. Could it warn first?");
    expect(pressed()).toEqual(["Idea"]);
  });

  it("opens the issue with the title, full text and label on ⌘Enter", () => {
    type("Pin a project to the top. I switch between twelve projects.");
    act(() => {
      box().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    });
    expect(bridge.open).toHaveBeenCalledTimes(1);
    const url = new URL(bridge.open.mock.calls[0][0] as string);
    expect(url.searchParams.get("title")).toBe("Pin a project to the top");
    expect(url.searchParams.get("body")).toBe(
      "Pin a project to the top. I switch between twelve projects.\n\n---\nlpm 0.7.32 · darwin/arm64",
    );
    expect(url.searchParams.get("labels")).toBe("enhancement");
    expect(useAppStore.getState().feedbackOpen).toBe(false);
  });
});
