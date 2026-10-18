// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  levelBlurb,
  loadNewTabPick,
  newTabPickLabel,
  resolveNewTabPick,
  saveNewTabPick,
} from "./newTabPick";

beforeEach(() => window.localStorage.clear());

describe("resolveNewTabPick", () => {
  it("keeps a pick the agents still offer", () => {
    expect(resolveNewTabPick({ agent: "codex", model: "gpt-6.1-sol", effort: "ultra" })).toEqual({
      agent: "codex",
      model: "gpt-6.1-sol",
      effort: "ultra",
    });
  });

  it("falls back to the defaults for what is no longer offered", () => {
    expect(resolveNewTabPick({ agent: "codex", model: "gpt-5.4-nano", effort: "ultra" })).toEqual({
      agent: "codex",
      model: "gpt-5.4-nano",
      effort: "",
    });
    expect(resolveNewTabPick({ agent: "claude", model: "gpt-6.1-sol", effort: "high" })).toEqual({
      agent: "claude",
      model: "",
      effort: "high",
    });
    expect(resolveNewTabPick({ agent: "aider" })).toEqual({ agent: "claude", model: "", effort: "" });
  });

  it("gives an agent without models nothing to pin", () => {
    expect(resolveNewTabPick({ agent: "gemini", model: "opus", effort: "high" })).toEqual({
      agent: "gemini",
      model: "",
      effort: "",
    });
  });
});

describe("the remembered pick", () => {
  it("comes back as saved", () => {
    saveNewTabPick({ agent: "claude", model: "opus", effort: "xhigh" });
    expect(loadNewTabPick()).toEqual({ agent: "claude", model: "opus", effort: "xhigh" });
  });

  it("starts on the default agent when nothing was saved or it can't be read", () => {
    expect(loadNewTabPick()).toEqual({ agent: "claude", model: "", effort: "" });
    window.localStorage.setItem("lpm:new-tab:last-pick:v1", "{not json");
    expect(loadNewTabPick()).toEqual({ agent: "claude", model: "", effort: "" });
  });
});

describe("newTabPickLabel", () => {
  it("reads agent, model and level", () => {
    expect(newTabPickLabel({ agent: "claude", model: "opus", effort: "high" })).toBe(
      "Claude Code · Opus · High",
    );
    expect(newTabPickLabel({ agent: "codex", model: "", effort: "" })).toBe("Codex · Default model");
    expect(newTabPickLabel({ agent: "opencode", model: "", effort: "" })).toBe("OpenCode");
  });
});

describe("levelBlurb", () => {
  it("uses the agents' own words", () => {
    expect(levelBlurb("claude", "high")).toBe("Comprehensive implementation with extensive testing");
    expect(levelBlurb("codex", "low")).toBe("Fast responses with lighter reasoning");
    expect(levelBlurb("codex", "")).toBe("Use the default effort level for your model");
  });
});
