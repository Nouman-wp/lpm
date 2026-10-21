import { describe, expect, it } from "vitest";
import { shellQuote } from "../../terminal-io";
import { parseLaunch } from "./parse";

describe("parseLaunch", () => {
  it("reads the prompt lpm passes after the agent's flags", () => {
    expect(parseLaunch(`claude --model opus --effort high ${shellQuote("fix the bug")}`)).toEqual({
      kind: "claude",
      prompt: "fix the bug",
      model: "opus",
      effort: "high",
    });
    expect(parseLaunch(`codex -c model_reasoning_effort=high ${shellQuote("it's broken")}`)).toEqual({
      kind: "codex",
      prompt: "it's broken",
      effort: "high",
    });
  });

  it("keeps the session id lpm mints for a new Claude conversation", () => {
    const id = "3f2b8c1e-9d4a-4b7e-a1c2-5e6f7a8b9c0d";
    expect(parseLaunch(`claude --session-id ${id} --model opus 'add tests'`)).toEqual({
      kind: "claude",
      prompt: "add tests",
      sessionId: id,
      model: "opus",
    });
  });

  it("reads the conversation a launch reopens", () => {
    expect(parseLaunch("claude --resume abc-123")).toEqual({ kind: "claude", prompt: "", resumeId: "abc-123" });
    expect(parseLaunch("codex resume 019fac59-0da4")).toEqual({
      kind: "codex",
      prompt: "",
      resumeId: "019fac59-0da4",
    });
    expect(parseLaunch("codex -m gpt-6-sol resume s1 'keep going'")).toEqual({
      kind: "codex",
      prompt: "keep going",
      resumeId: "s1",
      model: "gpt-6-sol",
    });
  });

  it("looks past env assignments and a path to the binary", () => {
    expect(parseLaunch("CLAUDE_CONFIG_DIR=/tmp/account /opt/bin/claude --resume old-id")?.resumeId).toBe("old-id");
    expect(parseLaunch("CODEX_HOME=/tmp/codex /usr/local/bin/codex 'hi'")).toEqual({ kind: "codex", prompt: "hi" });
  });

  it("does not take a boolean flag's neighbour as its value", () => {
    expect(parseLaunch("claude --dangerously-skip-permissions fix")?.prompt).toBe("fix");
    expect(parseLaunch("codex --full-auto fix it")?.prompt).toBe("fix it");
  });

  it("starts an agent with no prompt", () => {
    expect(parseLaunch("claude")).toEqual({ kind: "claude", prompt: "" });
    expect(parseLaunch("opencode")).toEqual({ kind: "opencode", prompt: "" });
    expect(parseLaunch("gemini -m gemini-3.1-flash")).toEqual({
      kind: "gemini",
      prompt: "",
      model: "gemini-3.1-flash",
    });
  });

  it("leaves other commands to the shell", () => {
    expect(parseLaunch("npm run dev")).toBeNull();
    expect(parseLaunch("FOO=bar")).toBeNull();
    expect(parseLaunch("")).toBeNull();
  });
});
