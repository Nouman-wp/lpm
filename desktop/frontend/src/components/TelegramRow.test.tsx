// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramRow } from "./TelegramRow";
import { useSendToStatus } from "../store/sendToStatus";

type Chat = { key: string; name: string; kind: string };
const state = { hasToken: false, chats: [] as Chat[] };
const sendTest = vi.fn();
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
  TelegramTest: (key?: string) => {
    sendTest(key);
    return Promise.resolve();
  },
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
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const settle = () => act(async () => {});

beforeEach(() => {
  useSendToStatus.setState({ telegram: undefined });
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
    await act(async () => root.render(<TelegramRow />));
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
    await act(async () => root.render(<TelegramRow />));
    await settle();
    expect(host.textContent).toContain("Posts through @lpm_bot");
    expect(host.textContent).toContain("AdaPrivate chat · default");
    expect(host.textContent).toContain("ReleasesChannel");

    await act(async () => [...host.querySelectorAll("button")].filter((b) => b.textContent === "Send test")[1].click());
    expect(sendTest).toHaveBeenCalledWith("releases");
    await act(async () => [...host.querySelectorAll("button")].filter((b) => b.textContent === "Remove")[1].click());
    await settle();
    expect(host.textContent).not.toContain("Releases");

    act(() => button("Add chat")!.click());
    expect(document.body.textContent).toContain("Add a Telegram chat");
  });
});
