import { describe, expect, it } from "vitest";
import {
  INSTRUCTION_PARTS,
  globalTextToSave,
  insertDefault,
  instructionsInEffect,
  partInEffect,
} from "./instructionSources";
import { DEFAULT_COMMIT_INSTRUCTIONS } from "./aiInstructions";

const [commit] = INSTRUCTION_PARTS.commit;
const [title, description] = INSTRUCTION_PARTS.pr;

describe("partInEffect", () => {
  it("prefers the project's own text over the global one", () => {
    expect(partInEffect(commit, "  Use emoji\n", "Be terse")).toEqual({
      label: "Commit message",
      text: "Use emoji",
      source: "project",
    });
  });

  it("falls back to the global text when the project's is blank", () => {
    expect(partInEffect(commit, " \n ", "Be terse").source).toBe("global");
  });

  it("counts a global text that is still the default as the default", () => {
    expect(partInEffect(commit, "", `${DEFAULT_COMMIT_INSTRUCTIONS}\n`)).toEqual({
      label: "Commit message",
      text: DEFAULT_COMMIT_INSTRUCTIONS,
      source: "default",
    });
    expect(partInEffect(commit, "", "").source).toBe("default");
  });
});

describe("instructionsInEffect", () => {
  it("names the project when any part is the project's own", () => {
    const parts = [partInEffect(title, "Short", ""), partInEffect(description, "", "Long")];
    expect(instructionsInEffect(parts).source).toBe("project");
  });

  it("names the global instructions when no part is the project's", () => {
    const parts = [partInEffect(title, "", ""), partInEffect(description, "", "Long")];
    expect(instructionsInEffect(parts).source).toBe("global");
  });

  it("names the default when nothing is customized", () => {
    const parts = [partInEffect(title, "", ""), partInEffect(description, "", "")];
    expect(instructionsInEffect(parts).source).toBe("default");
  });
});

describe("insertDefault", () => {
  it("fills an empty editor with the default", () => {
    expect(insertDefault("  ", "Rules")).toBe("Rules");
  });

  it("adds the default after what is already there", () => {
    expect(insertDefault("Mine\n\n", "Rules")).toBe("Mine\nRules");
  });
});

describe("globalTextToSave", () => {
  it("stores nothing for the untouched default", () => {
    expect(globalTextToSave(`${DEFAULT_COMMIT_INSTRUCTIONS}\n`, DEFAULT_COMMIT_INSTRUCTIONS)).toBe("");
  });

  it("stores an edited text as written", () => {
    expect(globalTextToSave("Mine", DEFAULT_COMMIT_INSTRUCTIONS)).toBe("Mine");
  });
});
