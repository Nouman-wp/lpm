import { describe, expect, it } from "vitest";
import { offersAutostash, pullErrorText } from "./gitPullErrors";

describe("pull errors", () => {
  it("offers autostash only when local changes are in the way", () => {
    expect(
      offersAutostash(
        "Your uncommitted changes to README.md would be overwritten by the new commits. Commit or stash them first, or pull with autostash.",
      ),
    ).toBe(true);
    expect(offersAutostash("fatal: no upstream")).toBe(false);
  });

  it("keeps a pull that landed with conflicts from reading as failed", () => {
    const landed = "Pulled, but README.md has conflicts. Resolve the conflict markers before you commit.";
    expect(pullErrorText(landed, "Pull failed")).toBe(landed);
    expect(pullErrorText(landed, "Pull failed in api", "api")).toBe(`api: ${landed}`);
    expect(pullErrorText("fatal: no upstream", "Pull failed")).toBe("Pull failed: fatal: no upstream");
  });
});
