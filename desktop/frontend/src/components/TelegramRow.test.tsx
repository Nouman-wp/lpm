// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramRow } from "./TelegramRow";
import { useSendToStatus } from "../store/sendToStatus";

type Chat = { key: string; name: string; kind: string };
const state = { hasToken: false, chats: [] as Chat[] };
const sendTest = vi.fn();
const toastError = vi.fn();
vi.mock("../../bridge/commands", () => ({
  TelegramStatus: () =>
    Promise.resolve({
      connected: state.hasToken && state.chats.length > 0,
      hasToken: state.hasToken,
      bot: state.hasToken ? "lpm_bot" : null,
      code: state.hasToken ? "c0de" : null,
      chats: state.chats,
    }),
  TelegramFindChats: () => Promise.resolve([]),
  TelegramTest: (key?: string) => Promise.resolve(sendTest(key)),
  TelegramRemoveChat: (key: string) => {
    state.chats = state.chats.filter((c) => c.key !== key);
    return Promise.resolve();
  },
  TelegramDisconnect: () => {
    state.hasToken = false;
    state.chats = [];
    return Promise.resolve();
  },
}));
vi.mock("../../bridge/runtime", () => ({ BrowserOpenURL: () => {} }));
vi.mock("../notifications/toast", () => ({
  toast: Object.assign(() => {}, { success: () => {}, error: (message: string) => toastError(message) }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

// What the button reads: one that confirms in place keeps its other label hidden beside it.
const shown = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return copy.textContent?.trim();
};
const button = (label: string) => [...document.body.querySelectorAll("button")].find((b) => shown(b) === label);
const rowButtons = (label: string) => [...host.querySelectorAll("button")].filter((b) => shown(b) === label);
const settle = () => act(async () => {});

beforeEach(() => {
  useSendToStatus.setState({ telegram: {} });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("TelegramRow", () => {
  it("connects through the dialog rather than a form of its own", async () => {
    state.hasToken = false;
    state.chats = [];
    await act(async () => root.render(<TelegramRow host={null} />));
    expect(host.textContent).toContain("Send automation results to a Telegram chat");
    expect(host.querySelector("input, textarea")).toBeNull();
    act(() => button("Connect")!.click());
    expect(document.body.textContent).toContain("Connect Telegram");
    expect(document.body.textContent).toContain("Create a bot in Telegram");
  });

  it("lists the chats with a test and a remove for each", async () => {
    state.hasToken = true;
    state.chats = [
      { key: "ada", name: "Ada", kind: "private" },
      { key: "releases", name: "Releases", kind: "channel" },
    ];
    await act(async () => root.render(<TelegramRow host={null} />));
    await settle();
    expect(host.textContent).toContain("Posts through @lpm_bot");
    expect(host.textContent).toContain("AdaPrivate chat · default");
    expect(host.textContent).toContain("ReleasesChannel");

    await act(async () => rowButtons("Send test")[1].click());
    expect(sendTest).toHaveBeenCalledWith("releases");
    expect(rowButtons("Send test")).toHaveLength(1);
    expect(rowButtons("Sent")).toHaveLength(1);
    await act(async () => rowButtons("Remove")[1].click());
    await settle();
    expect(host.textContent).not.toContain("Releases");

    act(() => button("Add chat")!.click());
    expect(document.body.textContent).toContain("Add a Telegram chat");
  });

  it("reports a test that didn't go out, and leaves the button as it was", async () => {
    state.hasToken = true;
    state.chats = [{ key: "ada", name: "Ada", kind: "private" }];
    sendTest.mockRejectedValueOnce("bot was blocked");
    await act(async () => root.render(<TelegramRow host={null} />));
    await settle();

    await act(async () => rowButtons("Send test")[0].click());
    expect(toastError).toHaveBeenCalledWith("Couldn't send the test message: bot was blocked");
    expect(rowButtons("Sent")).toHaveLength(0);
    expect(rowButtons("Send test")).toHaveLength(1);
  });
});
