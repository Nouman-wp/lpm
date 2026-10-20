import { describe, expect, it } from "vitest";
import { effortBlurb, menuCommit, menuEffect, shortEffortLabel, type MenuCursor } from "./agentModelMenu";

const cursor = (over: Partial<MenuCursor> = {}): MenuCursor => ({
  model: "opus",
  effort: "",
  ...over,
});

describe("effortBlurb", () => {
  it("describes each CLI's levels in that CLI's own words", () => {
    expect(effortBlurb("claude", "ultracode")).toBe(
      "xhigh + dynamic workflow orchestration, this session only",
    );
    expect(effortBlurb("claude", "auto")).toBe("Use the default effort level for your model");
    expect(effortBlurb("codex", "low")).toBe("Fast responses with lighter reasoning");
  });

  it("does not borrow one CLI's wording for the other", () => {
    expect(effortBlurb("codex", "low")).not.toBe(effortBlurb("claude", "low"));
    expect(effortBlurb("codex", "ultracode")).toBe("");
    expect(effortBlurb("claude", "ultra")).toBe("");
  });

  it("is empty for a level neither CLI describes", () => {
    expect(effortBlurb("claude", "")).toBe("");
    expect(effortBlurb("codex", "nonsense")).toBe("");
  });
});

describe("menuEffect", () => {
  // The rows can't show this on their own: a bare model pick leaves Claude's
  // level alone but resets Codex's, because Codex's picker confirms one every pass.
  it("spells out what a bare model pick does to the level, per CLI", () => {
    expect(menuEffect("claude", cursor(), { model: "sonnet", effort: "high" })).toBe(
      "Switch to Opus, leaving the level alone",
    );
    expect(menuEffect("codex", cursor({ model: "gpt-5.5" }), { model: "", effort: "" })).toBe(
      "Switch to GPT-5.5 at its default level",
    );
  });

  it("reads a level pick on the running model as a level change", () => {
    const c = cursor({ effort: "xhigh" });
    expect(menuEffect("claude", c, { model: "opus", effort: "low" })).toBe(
      "Set level to Extra High, staying on Opus",
    );
  });

  it("reads a level pick on another model as a move to that model", () => {
    const c = cursor({ model: "fable", effort: "ultracode" });
    expect(menuEffect("claude", c, { model: "opus", effort: "low" })).toBe(
      "Switch to Fable at Ultracode",
    );
  });

  // With no known model, "staying on" would be a claim lpm can't make.
  it("never claims to stay on a model it doesn't know", () => {
    const c = cursor({ effort: "high" });
    expect(menuEffect("claude", c, { model: "", effort: "" })).toBe("Switch to Opus at High");
  });

  it("says nothing when the cursor is what already runs", () => {
    expect(menuEffect("claude", cursor(), { model: "opus", effort: "high" })).toBe("");
    expect(menuEffect("claude", cursor({ effort: "high" }), { model: "opus", effort: "high" })).toBe("");
  });

  // Claude keeps the level across a model switch only when the new model takes
  // it, and clamps silently when it doesn't — so promising "leaving the level
  // alone" on the way to Haiku would be false.
  it("warns when the model being switched to has no such level", () => {
    expect(menuEffect("claude", cursor({ model: "haiku" }), { model: "opus", effort: "ultracode" })).toBe(
      "Switch to Haiku — it has no Ultracode",
    );
    expect(menuEffect("claude", cursor({ model: "haiku" }), { model: "opus", effort: "high" })).toBe(
      "Switch to Haiku, leaving the level alone",
    );
  });
});

describe("menuCommit", () => {
  it("sends a level alone when the cursor stays on the running model", () => {
    expect(menuCommit(cursor({ effort: "max" }), { model: "opus", effort: "high" })).toEqual({ effort: "max" });
  });

  it("sends the model with its level when the cursor is on another model", () => {
    expect(menuCommit(cursor({ model: "sonnet", effort: "high" }), { model: "opus", effort: "high" })).toEqual({
      model: "sonnet",
      effort: "high",
    });
  });

  it("sends a bare model when no level is picked for it", () => {
    expect(menuCommit(cursor({ model: "haiku" }), { model: "opus", effort: "ultracode" })).toEqual({
      model: "haiku",
    });
  });

  it("sends nothing for what already runs, or with no model under the cursor", () => {
    expect(menuCommit(cursor({ effort: "high" }), { model: "opus", effort: "high" })).toBeNull();
    expect(menuCommit(cursor(), { model: "opus", effort: "" })).toBeNull();
    expect(menuCommit(cursor({ model: "" }), { model: "", effort: "" })).toBeNull();
  });
});

describe("shortEffortLabel", () => {
  it("shortens only the labels too long for the level row", () => {
    expect(shortEffortLabel("medium", "Medium")).toBe("Med");
    expect(shortEffortLabel("xhigh", "Extra High")).toBe("XHigh");
    expect(shortEffortLabel("ultracode", "Ultracode")).toBe("Ultracode");
  });
});
