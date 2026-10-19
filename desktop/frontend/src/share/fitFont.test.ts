import { describe, expect, it } from "vitest";
import { MIN_SHARED_FONT_SIZE, nextFontSize, type FitState } from "./fitFont";

const fresh = (): FitState => ({ overflowsAt: Infinity });

describe("shared tab font fit", () => {
  it("keeps the user's size when the host's grid fits", () => {
    expect(nextFontSize(12, 12, 1.4, fresh())).toBe(12);
  });

  it("shrinks until the host's grid fits", () => {
    expect(nextFontSize(12, 12, 0.5, fresh())).toBe(6);
    expect(nextFontSize(12, 12, 0.8, fresh())).toBe(9);
  });

  it("never goes below a readable floor", () => {
    expect(nextFontSize(12, 12, 0.1, fresh())).toBe(MIN_SHARED_FONT_SIZE);
  });

  it("grows back when there's room, but not past a size that overflowed", () => {
    const state = fresh();
    expect(nextFontSize(12, 12, 0.9, state)).toBe(10);
    expect(nextFontSize(10, 12, 1.15, state)).toBe(11);
    expect(nextFontSize(11, 12, 1.05, state)).toBe(11);
  });

  it("settles instead of bouncing between two sizes", () => {
    const state = fresh();
    let size = 12;
    const ratioAt = (s: number) => (s >= 11 ? 0.97 : 1.06);
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      size = nextFontSize(size, 12, ratioAt(size), state);
      seen.push(size);
    }
    expect(seen.slice(-3)).toEqual([10, 10, 10]);
  });

  it("ignores a ratio from an unmeasured screen", () => {
    expect(nextFontSize(12, 12, NaN, fresh())).toBe(12);
    expect(nextFontSize(12, 12, 0, fresh())).toBe(12);
  });
});
