import { describe, expect, it } from "vitest";
import { SPLIT_MIN_WIDTH, splitFits } from "./diffSplit";

describe("splitFits", () => {
  it("splits a stack wider than the minimum, like the review at the default window", () => {
    expect(splitFits(806)).toBe(true);
    expect(splitFits(SPLIT_MIN_WIDTH + 1)).toBe(true);
  });

  it("matches Monaco's inline fallback at and below the minimum", () => {
    expect(splitFits(SPLIT_MIN_WIDTH)).toBe(false);
    expect(splitFits(330)).toBe(false);
  });

  it("assumes an unmeasured stack fits", () => {
    expect(splitFits(0)).toBe(true);
  });
});
