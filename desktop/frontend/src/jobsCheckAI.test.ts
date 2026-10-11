import { describe, expect, it } from "vitest";
import { checkRequest, checkTask, cleanCheckCommand } from "./jobsCheckAI";
import { defaultJobDraft, type JobDraft } from "./jobsFormat";
import type { ActionInfo } from "./types";

const draft = (values: Partial<JobDraft>): JobDraft => ({ ...defaultJobDraft(), ...values });
const prompt = (text: string) => ({ ...defaultJobDraft().prompt, text });

describe("checkTask", () => {
  it("hands over the prompt of an AI job", () => {
    expect(checkTask(draft({ runMode: "prompt", prompt: prompt(" Fix lint ") }), null)).toBe(
      "Fix lint",
    );
  });

  it("describes a command job by its command", () => {
    expect(checkTask(draft({ runMode: "cmd", cmd: "npm run refresh" }), null)).toBe(
      "Runs this shell command: npm run refresh",
    );
    expect(checkTask(draft({ runMode: "cmd", cmd: "  " }), null)).toBe("");
  });

  it("describes an action job by its action and prompt", () => {
    const action = { label: "Claude", cmd: "claude" } as ActionInfo;
    expect(
      checkTask(draft({ runMode: "action", prompt: prompt("Triage issues") }), action),
    ).toBe('Runs the "Claude" action: claude\nWith this prompt: Triage issues');
    expect(checkTask(draft({ runMode: "action" }), null)).toBe("");
  });
});

describe("cleanCheckCommand", () => {
  it("strips fences, backticks and a prompt sign", () => {
    expect(cleanCheckCommand("```sh\n$ git status --porcelain | grep .\n```")).toBe(
      "git status --porcelain | grep .",
    );
    expect(cleanCheckCommand("`gh pr list | grep .`")).toBe("gh pr list | grep .");
    expect(cleanCheckCommand("  \n")).toBe("");
  });
});

describe("checkRequest", () => {
  it("adds what the job does when there is something to say", () => {
    expect(checkRequest(" When CI is red ", "")).toBe("When it should run: When CI is red");
    expect(checkRequest("When CI is red", "Fix CI")).toBe(
      "When it should run: When CI is red\n\nWhat the job does: Fix CI",
    );
  });
});
