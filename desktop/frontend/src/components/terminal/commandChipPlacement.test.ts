import { describe, expect, it } from "vitest";
import { placeCommandChip } from "./commandChipPlacement";

const view = { width: 1440, height: 900 };
const size = { width: 220, height: 26 };
const anchor = { endLeft: 300, endTop: 400, startLeft: 120, startTop: 400, rowHeight: 18, right: 1200 };

describe("placeCommandChip", () => {
  it("sits just past the command, centered on its row", () => {
    expect(placeCommandChip(anchor, size, view)).toEqual({ left: 306, top: 396 });
  });

  it("goes above the command when the row has no room left", () => {
    expect(placeCommandChip({ ...anchor, endLeft: 1100 }, size, view)).toEqual({ left: 120, top: 370 });
  });

  it("goes below a command on the window's first rows", () => {
    expect(placeCommandChip({ ...anchor, endLeft: 1100, startTop: 10, endTop: 10 }, size, view)).toEqual({
      left: 120,
      top: 32,
    });
  });

  it("stays inside the window", () => {
    expect(placeCommandChip({ ...anchor, endLeft: 1400, startLeft: 1380, right: 1440 }, size, view).left).toBe(
      1440 - 8 - 220,
    );
  });
});
