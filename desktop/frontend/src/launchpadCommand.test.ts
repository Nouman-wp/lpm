import { describe, expect, it } from "vitest";
import { launchpadCommand } from "./launchpadCommand";

describe("launchpadCommand", () => {
  it("reads a line after a standalone $ as a command", () => {
    expect(launchpadCommand("$ npm test")).toBe("npm test");
    expect(launchpadCommand("$   git status  ")).toBe("git status");
  });

  it("opens a plain shell for a $ on its own", () => {
    expect(launchpadCommand("$")).toBe("");
  });

  it("leaves prompts and $-words to the agent", () => {
    expect(launchpadCommand("Fix the flaky test")).toBeNull();
    expect(launchpadCommand("$HOME/bin/run")).toBeNull();
    expect(launchpadCommand("Costs $5 a month")).toBeNull();
  });
});
