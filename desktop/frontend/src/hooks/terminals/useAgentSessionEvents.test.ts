import { describe, expect, it, vi } from "vitest";

vi.mock("../../mirror", () => ({ IS_MIRROR_WINDOW: false }));
vi.mock("../../../bridge/runtime", () => ({ EventsOn: vi.fn() }));

import { makePaneLeaf, makeTerminal } from "../../paneTree";
import { applyAgentSessionEnded, applyAgentSessionEvent } from "./useAgentSessionEvents";

const event = (
  provider: "claude" | "codex",
  sessionId: string,
  paneId = "term-1",
) => ({
  project: "project",
  paneId,
  provider,
  sessionId,
});

describe("applyAgentSessionEvent", () => {
  it("records an ad-hoc Claude session and makes it resumable", () => {
    const tree = makePaneLeaf("pane", [makeTerminal("term-1", "Claude")]);

    const next = applyAgentSessionEvent(
      tree,
      "project",
      event("claude", "claude-1"),
    );
    const tab = next?.kind === "leaf" ? next.tabs[0] : null;

    expect(tab?.agentSession).toEqual({
      provider: "claude",
      sessionId: "claude-1",
    });
    expect(tab?.resumeCmd).toBe("claude --resume claude-1");
  });

  it("replaces a Claude session in the same terminal and clears its vendor title", () => {
    const tree = makePaneLeaf("pane", [
      makeTerminal("term-1", "Claude", {
        resumeCmd: "claude --resume old-id --model opus",
        sessionTitle: "Old conversation",
        sessionTitleId: "old-id",
        sessionTitleSource: "vendor",
      }),
    ]);

    const next = applyAgentSessionEvent(
      tree,
      "project",
      event("claude", "new-id"),
    );
    const tab = next?.kind === "leaf" ? next.tabs[0] : null;

    expect(tab?.resumeCmd).toBe("claude --resume new-id --model opus");
    expect(tab?.agentSession?.sessionId).toBe("new-id");
    expect(tab?.sessionTitle).toBeUndefined();
    expect(tab?.sessionTitleId).toBeUndefined();
    expect(tab?.sessionTitleSource).toBeUndefined();
  });

  it("handles a provider switch and preserves a manual override", () => {
    const tree = makePaneLeaf("pane", [
      makeTerminal("term-1", "My tab", {
        startCmd: "claude --model opus",
        resumeCmd: "claude --resume claude-1",
        sessionTitleSource: "manual",
      }),
    ]);

    const next = applyAgentSessionEvent(
      tree,
      "project",
      event("codex", "codex-1"),
    );
    const tab = next?.kind === "leaf" ? next.tabs[0] : null;

    expect(tab?.agentSession).toEqual({
      provider: "codex",
      sessionId: "codex-1",
    });
    expect(tab?.resumeCmd).toBe("codex resume codex-1");
    expect(tab?.label).toBe("My tab");
    expect(tab?.sessionTitleSource).toBe("manual");
  });

  it("keeps an existing title for a duplicate event from the same session", () => {
    const tree = makePaneLeaf("pane", [
      makeTerminal("term-1", "Claude", {
        resumeCmd: "claude --resume same-id",
        sessionTitle: "Current conversation",
        sessionTitleId: "same-id",
        sessionTitleSource: "vendor",
        agentSession: { provider: "claude", sessionId: "same-id" },
      }),
    ]);

    const next = applyAgentSessionEvent(
      tree,
      "project",
      event("claude", "same-id"),
    );
    const tab = next?.kind === "leaf" ? next.tabs[0] : null;

    expect(tab?.sessionTitle).toBe("Current conversation");
    expect(tab?.sessionTitleId).toBe("same-id");
    expect(tab?.sessionTitleSource).toBe("vendor");
  });

  it("ignores another project, an unknown pane, and malformed payloads", () => {
    const tree = makePaneLeaf("pane", [makeTerminal("term-1", "Claude")]);

    expect(
      applyAgentSessionEvent(tree, "other", event("claude", "session")),
    ).toBe(tree);
    expect(
      applyAgentSessionEvent(
        tree,
        "project",
        event("claude", "session", "missing"),
      ),
    ).toBe(tree);
    expect(
      applyAgentSessionEvent(tree, "project", {
        ...event("claude", "session"),
        provider: "gemini",
      }),
    ).toBe(tree);
    expect(
      applyAgentSessionEvent(
        tree,
        "project",
        event("claude", "unsafe session"),
      ),
    ).toBe(tree);
  });
});

describe("applyAgentSessionEnded", () => {
  const ended = (sessionId: string, paneId = "term-1", project = "project") => ({
    project,
    paneId,
    sessionId,
  });
  const running = () =>
    makePaneLeaf("pane", [
      makeTerminal("term-1", "Claude", {
        agentSession: { provider: "claude", sessionId: "s1" },
        resumeCmd: "claude --resume s1",
      }),
      makeTerminal("term-2", "Shell"),
    ]);
  const tabOf = (tree: ReturnType<typeof applyAgentSessionEnded>, i = 0) =>
    tree?.kind === "leaf" ? tree.tabs[i] : null;

  it("marks the tab whose agent was quit and keeps its resume command", () => {
    const next = applyAgentSessionEnded(running(), "project", ended("s1"));
    expect(tabOf(next)?.agentEnded).toBe(true);
    expect(tabOf(next)?.resumeCmd).toBe("claude --resume s1");
    expect(tabOf(next, 1)?.agentEnded).toBeUndefined();
  });

  it("goes by the resume command for a restored tab", () => {
    const tree = makePaneLeaf("pane", [
      makeTerminal("term-1", "Claude", { resumeCmd: "claude --resume s1" }),
    ]);
    expect(tabOf(applyAgentSessionEnded(tree, "project", ended("s1")))?.agentEnded).toBe(true);
  });

  it("ignores a session the tab has moved on from, another project, and junk", () => {
    const tree = running();
    expect(applyAgentSessionEnded(tree, "project", ended("old"))).toBe(tree);
    expect(applyAgentSessionEnded(tree, "project", ended("s1", "term-1", "other"))).toBe(tree);
    expect(applyAgentSessionEnded(tree, "project", ended("s1", "missing"))).toBe(tree);
    expect(applyAgentSessionEnded(tree, "project", { project: "project" })).toBe(tree);
  });

  it("is cleared by the next agent the tab starts", () => {
    const quit = applyAgentSessionEnded(running(), "project", ended("s1"));
    const restarted = applyAgentSessionEvent(quit, "project", event("claude", "s2"));
    expect(tabOf(restarted)?.agentEnded).toBeUndefined();
    expect(tabOf(restarted)?.resumeCmd).toBe("claude --resume s2");
  });
});
