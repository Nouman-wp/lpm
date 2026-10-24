import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendNow: vi.fn(),
  toast: vi.fn(),
  success: vi.fn(),
  focusProjectTerminal: vi.fn(),
  keepAsDraft: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock("../../bridge/commands", () => ({ SendLaterSendNow: mocks.sendNow }));
vi.mock("../../bridge/runtime", () => ({ EventsOn: vi.fn(() => () => {}) }));
vi.mock("sonner", () => ({ toast: Object.assign(mocks.toast, { error: vi.fn(), success: mocks.success }) }));
vi.mock("../store/app", () => ({
  useAppStore: { getState: () => ({ focusProjectTerminal: mocks.focusProjectTerminal }) },
}));
vi.mock("./closeout", () => ({ keepAsDraft: mocks.keepAsDraft }));
vi.mock("../store/messageHistory", () => ({ deleteMessage: mocks.deleteMessage }));

import { keepScheduledAsDraft, registerComposerHost, sendScheduledNow } from "./actions";
import { setHold, type ScheduledPrompt } from "../store/sendLater";
import { useTerminalTargets } from "../store/terminalTargets";

const item: ScheduledPrompt = {
  id: "p1",
  projectName: "api",
  historyKey: "hk-1",
  terminalLabel: "Terminal 1",
  agent: "claude",
  text: "next step",
  images: {},
  dueAt: 0,
  createdAt: 0,
  state: "due",
  kind: "time",
  force: false,
};

beforeEach(() => {
  mocks.sendNow.mockReset().mockResolvedValue(undefined);
  mocks.toast.mockReset();
  mocks.success.mockReset();
  mocks.focusProjectTerminal.mockReset();
  mocks.keepAsDraft.mockReset().mockResolvedValue("draft-9");
  mocks.deleteMessage.mockReset();
  setHold(item.id, null);
  useTerminalTargets.getState().setProjectTargets("api", [
    { id: "pty-7", label: "Terminal 1", emoji: "", historyKey: "hk-1" },
  ]);
});

describe("sendScheduledNow", () => {
  it("sends a prompt held behind a busy agent without a word", () => {
    setHold(item.id, "busy");
    sendScheduledNow(item);
    expect(mocks.sendNow).toHaveBeenCalledWith("p1");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("shows the question a prompt is held behind instead of answering it", () => {
    setHold(item.id, "asking");
    sendScheduledNow(item);
    expect(mocks.sendNow).toHaveBeenCalledWith("p1");
    expect(mocks.toast).toHaveBeenCalledWith(
      "Terminal 1 is waiting for your answer",
      expect.objectContaining({ description: expect.stringContaining("right after") }),
    );
    expect(mocks.focusProjectTerminal).toHaveBeenCalledWith("api", "pty-7");
  });
});

describe("Saved to Drafts", () => {
  const missed = { ...item, text: "Refactor the session restore so a pane keeps its split ratio after reload", images: { "1": "/a.png" } };

  function host() {
    return { restore: vi.fn(), openPicker: vi.fn(), openDrafts: vi.fn(() => true) };
  }

  async function saveMissed() {
    await keepScheduledAsDraft(missed);
    const [title, opts] = mocks.success.mock.calls.at(-1)!;
    return { title, opts } as {
      title: string;
      opts: { description: string; cancel: { label: string; onClick: () => void }; action: { label: string; onClick: () => void } };
    };
  }

  it("says where the prompt went and offers Open Drafts and Undo", async () => {
    const { title, opts } = await saveMissed();
    expect(title).toBe("Saved to Drafts");
    expect(opts.description).toBe("“Refactor the session restore so a pane keeps its split rati…”");
    expect(opts.cancel.label).toBe("Open Drafts");
    expect(opts.action.label).toBe("Undo");
  });

  it("undo takes the draft back out and into its input", async () => {
    const h = host();
    const unregister = registerComposerHost("hk-1", h);
    const { opts } = await saveMissed();
    opts.action.onClick();
    expect(mocks.deleteMessage).toHaveBeenCalledWith("draft-9");
    expect(h.restore).toHaveBeenCalledWith(missed.text, missed.images);
    unregister();
  });

  it("undo keeps the draft when its input isn't open here", async () => {
    useTerminalTargets.getState().setProjectTargets("api", []);
    const { opts } = await saveMissed();
    opts.action.onClick();
    expect(mocks.deleteMessage).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith("Kept as a draft", expect.anything());
  });

  it("opens Drafts in the input on screen", async () => {
    const h = host();
    const unregister = registerComposerHost("hk-1", h);
    const { opts } = await saveMissed();
    opts.cancel.onClick();
    expect(h.openDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.focusProjectTerminal).not.toHaveBeenCalled();
    unregister();
  });

  it("brings an input that is off screen back into view for Drafts", async () => {
    const h = { ...host(), openDrafts: vi.fn(() => false) };
    const unregister = registerComposerHost("hk-1", h);
    const { opts } = await saveMissed();
    opts.cancel.onClick();
    expect(h.openDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.focusProjectTerminal).toHaveBeenCalledWith("api", "pty-7");
    unregister();
  });

  it("brings its terminal into view and opens Drafts once the input shows", async () => {
    const { opts } = await saveMissed();
    opts.cancel.onClick();
    expect(mocks.focusProjectTerminal).toHaveBeenCalledWith("api", "pty-7");
    const h = host();
    const unregister = registerComposerHost("hk-1", h);
    expect(h.openDrafts).toHaveBeenCalledTimes(1);
    unregister();
    const again = host();
    registerComposerHost("hk-1", again)();
    expect(again.openDrafts).not.toHaveBeenCalled();
  });
});
