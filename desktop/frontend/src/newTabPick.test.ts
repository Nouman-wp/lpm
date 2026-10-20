// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  levelBlurb,
  loadNewTabMemory,
  newTabModelLabel,
  resolveNewTabPick,
  saveNewTabMemory,
} from "./newTabPick";

beforeEach(() => window.localStorage.clear());

describe("resolveNewTabPick", () => {
  it("keeps a pick the agents still offer", () => {
    expect(resolveNewTabPick("codex", { model: "gpt-6.1-sol", effort: "ultra" })).toEqual({
      agent: "codex",
      model: "gpt-6.1-sol",
      effort: "ultra",
    });
  });

  it("falls back to the defaults for what is no longer offered", () => {
    expect(resolveNewTabPick("codex", { model: "gpt-5.4-nano", effort: "ultra" })).toEqual({
      agent: "codex",
      model: "gpt-5.4-nano",
      effort: "",
    });
    expect(resolveNewTabPick("claude", { model: "gpt-6.1-sol", effort: "high" })).toEqual({
      agent: "claude",
      model: "",
      effort: "high",
    });
  });

  it("gives an agent without models nothing to pin", () => {
    expect(resolveNewTabPick("gemini", { model: "opus", effort: "high" })).toEqual({
      agent: "gemini",
      model: "",
      effort: "",
    });
  });
});

describe("the remembered picks", () => {
  it("come back as saved, each agent with its own", () => {
    const memory = loadNewTabMemory();
    saveNewTabMemory({
      ...memory,
      claude: { agent: "claude", model: "opus", effort: "xhigh" },
      codex: { agent: "codex", model: "gpt-6-sol", effort: "high" },
    });
    const loaded = loadNewTabMemory();
    expect(loaded.claude).toEqual({ agent: "claude", model: "opus", effort: "xhigh" });
    expect(loaded.codex).toEqual({ agent: "codex", model: "gpt-6-sol", effort: "high" });
    expect(loaded.gemini).toEqual({ agent: "gemini", model: "", effort: "" });
  });

  it("start on each agent's defaults when nothing was saved or it can't be read", () => {
    expect(loadNewTabMemory().codex).toEqual({ agent: "codex", model: "", effort: "" });
    window.localStorage.setItem("lpm:new-tab:picks:v1", "{not json");
    expect(loadNewTabMemory().claude).toEqual({ agent: "claude", model: "", effort: "" });
  });

  it("drop what is no longer offered", () => {
    window.localStorage.setItem(
      "lpm:new-tab:picks:v1",
      JSON.stringify({ last: "aider", picks: { codex: { model: "gpt-9", effort: "high" }, claude: "opus" } }),
    );
    const loaded = loadNewTabMemory();
    expect(loaded.codex).toEqual({ agent: "codex", model: "", effort: "high" });
    expect(loaded.claude).toEqual({ agent: "claude", model: "", effort: "" });
  });
});

describe("newTabModelLabel", () => {
  it("reads model and level", () => {
    expect(newTabModelLabel({ agent: "claude", model: "opus", effort: "high" })).toBe("Opus · High");
    expect(newTabModelLabel({ agent: "codex", model: "", effort: "" })).toBe("Default model");
    expect(newTabModelLabel({ agent: "opencode", model: "", effort: "" })).toBe("");
  });
});

describe("levelBlurb", () => {
  it("uses the agents' own words", () => {
    expect(levelBlurb("claude", "high")).toBe("Comprehensive implementation with extensive testing");
    expect(levelBlurb("codex", "low")).toBe("Fast responses with lighter reasoning");
    expect(levelBlurb("codex", "")).toBe("Use the default effort level for your model");
  });
});
