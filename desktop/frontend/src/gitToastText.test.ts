import { describe, expect, it } from "vitest";
import { pulledText, pushedText, syncedText } from "./gitToastText";

describe("git toast text", () => {
  it("names the commits and the branch", () => {
    expect(pushedText(2, "feat/billing-flow")).toBe("Pushed 2 commits from feat/billing-flow");
    expect(pushedText(1, "main")).toBe("Pushed 1 commit from main");
    expect(pulledText(3, "main")).toBe("Pulled 3 commits into main");
    expect(syncedText(2, 4, "exp/data")).toBe("Pulled 2, pushed 4 commits on exp/data");
  });

  it("falls back to the branch alone when there is nothing to count", () => {
    expect(pushedText(0, "main")).toBe("Pushed main");
    expect(pulledText(0, "")).toBe("Pulled");
  });
});
