import { describe, expect, it } from "vitest";
import { hiddenTabs, sameHiddenTabs } from "./tabOverflow";

const view = { left: 100, right: 400 };
const tabs = [
  { key: "a", left: 20, right: 90 },
  { key: "b", left: 92, right: 160 },
  { key: "c", left: 162, right: 250 },
  { key: "d", left: 252, right: 380 },
  { key: "e", left: 382, right: 460 },
];

describe("hiddenTabs", () => {
  it("counts tabs off the edge and the one cut by it", () => {
    expect(hiddenTabs(view, tabs, { left: true, right: true }, 32)).toEqual({
      left: ["a", "b"],
      right: ["d", "e"],
    });
  });

  it("counts a whole tab that reaches under the chip", () => {
    expect(hiddenTabs(view, [{ key: "x", left: 110, right: 180 }], { left: true, right: false }, 32).left).toEqual([
      "x",
    ]);
  });

  it("counts nothing on a side with nothing more to scroll to", () => {
    expect(hiddenTabs(view, tabs, { left: false, right: false }, 32)).toEqual({ left: [], right: [] });
  });
});

describe("sameHiddenTabs", () => {
  it("compares both sides in order", () => {
    expect(sameHiddenTabs({ left: ["a"], right: [] }, { left: ["a"], right: [] })).toBe(true);
    expect(sameHiddenTabs({ left: ["a"], right: [] }, { left: [], right: ["a"] })).toBe(false);
  });
});
