import { describe, expect, it } from "vitest";
import type { ScheduledPrompt } from "../store/sendLater";
import { promptStatus } from "./status";

const NOW = new Date(2026, 9, 26, 14, 30).getTime();

function prompt(over: Partial<ScheduledPrompt>): ScheduledPrompt {
  return {
    id: "a",
    projectName: "saas-app",
    historyKey: "k",
    terminalLabel: "Claude",
    agent: "claude",
    text: "add a changelog page",
    images: {},
    dueAt: NOW - 60_000,
    createdAt: NOW - 60_000,
    state: "due",
    kind: "done",
    force: false,
    ...over,
  };
}

describe("promptStatus for a prompt queued until the agent is done", () => {
  it("says it goes next, when the agent finishes", () => {
    const status = promptStatus(prompt({}), "busy", NOW);
    expect(status.tone).toBe("waiting");
    expect(status.title).toBe("Next, when Claude finishes");
    expect(status.detail).toMatch(/^queued /);
  });

  it("names the command for a plain shell", () => {
    const status = promptStatus(prompt({ agent: "", terminalLabel: "Terminal 1" }), undefined, NOW);
    expect(status.title).toBe("Next, when the command in Terminal 1 finishes");
  });

  it("says it's paused after a problem, and how to send it anyway", () => {
    const status = promptStatus(prompt({}), "problem", NOW);
    expect(status.title).toBe("Paused · Claude hit a problem");
    expect(status.detail).toBe("Send now sends it anyway");
  });

  it("keeps the shared waits: a question and a closed tab", () => {
    expect(promptStatus(prompt({}), "asking", NOW).title).toBe("Waiting for your answer in Claude");
    expect(promptStatus(prompt({}), "away", NOW).title).toBe("Waiting for Claude to open");
  });

  it("explains a miss without a time it was due", () => {
    expect(promptStatus(prompt({ state: "missed" }), undefined, NOW).title).toBe(
      "Missed · lpm closed before Claude finished",
    );
  });

  it("leaves timed prompts worded as before", () => {
    const status = promptStatus(prompt({ kind: "time" }), "busy", NOW);
    expect(status.title).toBe("Waiting for Claude to finish");
    expect(status.detail).toMatch(/sends when it's ready$/);
  });
});
