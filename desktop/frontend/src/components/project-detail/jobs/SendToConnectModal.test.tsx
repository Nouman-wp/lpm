// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendToConnectModal } from "./SendToConnectModal";
import { useSendToStatus } from "../../../store/sendToStatus";

type Chat = { key: string; name: string; kind: string };
const link = { hasToken: false, chats: [] as Chat[], incoming: [] as Chat[] };
const sendTest = vi.fn();
vi.mock("../../../../bridge/commands", () => ({
  TelegramStatus: () =>
    Promise.resolve({
      connected: link.hasToken && link.chats.length > 0,
      hasToken: link.hasToken,
      bot: link.hasToken ? "lpm_bot" : null,
      code: link.hasToken ? "c0de" : null,
      chats: link.chats,
    }),
  TelegramConnect: () => {
    link.hasToken = true;
    return Promise.resolve({ bot: "lpm_bot" });
  },
  TelegramFindChats: () => {
    const added = link.incoming;
    link.chats = [...link.chats, ...added];
    link.incoming = [];
    return Promise.resolve(added);
  },
  TelegramRemoveChat: () => Promise.resolve(),
  TelegramTest: () => {
    sendTest();
    return Promise.resolve();
  },
  TelegramDisconnect: () => Promise.resolve(),
}));
const opened = vi.fn();
vi.mock("../../../../bridge/runtime", () => ({ BrowserOpenURL: (url: string) => opened(url) }));
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const settle = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  link.hasToken = false;
  link.chats = [];
  link.incoming = [];
  useSendToStatus.setState({ telegram: undefined });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("SendToConnectModal", () => {
  it("connects Telegram in two steps without leaving the job", async () => {
    await act(async () => root.render(<SendToConnectModal destination="telegram" onClose={onClose} />));
    await settle();
    expect(document.body.textContent).toContain("Connect Telegram");
    act(() => button("Create a bot in Telegram")!.click());
    expect(opened).toHaveBeenLastCalledWith("https://t.me/BotFather?text=%2Fnewbot");

    const reply = document.body.querySelector<HTMLTextAreaElement>('textarea[aria-label="BotFather\'s reply"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        reply,
        "Done! Use this token to access the HTTP API:\n123456789:AAFakeTokenForTestsOnly_abc-DEF123456\nKeep it secure",
      );
      reply.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    expect(document.body.textContent).toContain("Using @lpm_bot.");
    expect(document.body.textContent).toContain("Waiting for you to tap Start…");
    act(() => button("Open @lpm_bot")!.click());
    expect(opened).toHaveBeenLastCalledWith("https://t.me/lpm_bot?start=c0de");

    link.incoming = [{ key: "ada", name: "Ada", kind: "private" }];
    await act(async () => vi.advanceTimersByTime(2500));
    await settle();
    expect(document.body.textContent).toContain("Connected to Ada.");
    // The job editor's pill reads the same status, so it turns ready too.
    expect(useSendToStatus.getState().telegram?.connected).toBe(true);
    act(() => button("Done")!.click());
    expect(onClose).toHaveBeenCalled();
  });

  it("adds another chat once connected, handing it to the job", async () => {
    link.hasToken = true;
    link.chats = [{ key: "ada", name: "Ada", kind: "private" }];
    const onAdded = vi.fn();
    await act(async () =>
      root.render(<SendToConnectModal destination="telegram" intent="add" onClose={onClose} onAdded={onAdded} />),
    );
    await settle();
    expect(document.body.textContent).toContain("Add a Telegram chat");
    act(() => button("Add to a group")!.click());
    expect(opened).toHaveBeenLastCalledWith("https://t.me/lpm_bot?startgroup=c0de");
    act(() => button("Add to a channel")!.click());
    expect(opened).toHaveBeenLastCalledWith("https://t.me/lpm_bot?startchannel&admin=post_messages");
    expect(document.body.textContent).toContain("Ada");

    link.incoming = [{ key: "releases", name: "Releases", kind: "channel" }];
    await act(async () => vi.advanceTimersByTime(2500));
    await settle();
    expect(onAdded).toHaveBeenCalledWith(["telegram:releases"]);
    expect(document.body.textContent).toContain("ReleasesJust added");
    expect(document.body.textContent).toContain("Channel");
  });

  it("shows nothing for a destination it has no way to connect", () => {
    act(() => root.render(<SendToConnectModal destination="lpm" onClose={onClose} />));
    expect(document.body.textContent).not.toContain("Connect");
  });
});
