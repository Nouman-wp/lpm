// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { recentModels, rememberModel, splitModels } from "./modelSwitchRecents";

const models = ["a", "b", "c", "d", "e", "f"].map((value) => ({ value, label: value.toUpperCase() }));
const values = (list: { value: string }[]) => list.map((m) => m.value);

describe("splitModels", () => {
  it("leads with the running model, then recent picks, then the agent's order", () => {
    const { top, rest } = splitModels(models, "d", ["f", "d"]);
    expect(values(top)).toEqual(["d", "f", "a"]);
    expect(values(rest)).toEqual(["b", "c", "e"]);
  });

  it("fills from the agent's order when nothing is known yet", () => {
    const { top, rest } = splitModels(models, "", []);
    expect(values(top)).toEqual(["a", "b", "c"]);
    expect(values(rest)).toEqual(["d", "e", "f"]);
  });

  it("skips models the agent no longer offers", () => {
    expect(values(splitModels(models, "gone", ["old", "e"]).top)).toEqual(["e", "a", "b"]);
  });

  it("shows every model rather than folding away just one", () => {
    const four = models.slice(0, 4);
    expect(splitModels(four, "d", [])).toEqual({ top: four, rest: [] });
  });
});

describe("rememberModel", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the newest pick first, once, per agent", () => {
    rememberModel("codex", "gpt-6-sol");
    rememberModel("codex", "gpt-6-astra");
    rememberModel("codex", "gpt-6-sol");
    rememberModel("claude", "opus");
    expect(recentModels("codex")).toEqual(["gpt-6-sol", "gpt-6-astra"]);
    expect(recentModels("claude")).toEqual(["opus"]);
  });

  it("reads a damaged entry as no history", () => {
    window.localStorage.setItem("lpm:model-switch:recent:v1", '{"codex": "gpt-6-sol"}');
    expect(recentModels("codex")).toEqual([]);
  });
});
