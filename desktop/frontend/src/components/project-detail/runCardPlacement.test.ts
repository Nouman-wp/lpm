import { describe, expect, it } from "vitest";
import { RUN_CARD_WIDTH, placeRunCard, runDuration } from "./runCardPlacement";

const view = { width: 1440, height: 900 };

describe("placeRunCard", () => {
  it("opens under a header button, lined up with its right edge", () => {
    expect(placeRunCard({ top: 12, bottom: 44, right: 1140 }, view)).toEqual({
      top: 52,
      left: 1140 - RUN_CARD_WIDTH,
    });
  });

  it("opens over a footer button", () => {
    expect(placeRunCard({ top: 864, bottom: 892, right: 1038 }, view)).toEqual({
      bottom: 900 - 864 + 8,
      left: 1038 - RUN_CARD_WIDTH,
    });
  });

  it("stays inside the window", () => {
    expect(placeRunCard({ top: 12, bottom: 44, right: 200 }, view).left).toBe(12);
    expect(placeRunCard({ top: 12, bottom: 44, right: 1440 }, view).left).toBe(1440 - 12 - RUN_CARD_WIDTH);
  });

  it("opens under the header when no button on screen started the run", () => {
    expect(placeRunCard(null, view)).toEqual({ top: 56, left: 1440 - 12 - RUN_CARD_WIDTH });
  });
});

describe("runDuration", () => {
  it("keeps a tenth of a second for quick runs", () => {
    expect(runDuration(1234)).toBe("1.2 s");
    expect(runDuration(-5)).toBe("0.0 s");
  });

  it("counts whole seconds and minutes for longer ones", () => {
    expect(runDuration(45_000)).toBe("45s");
    expect(runDuration(125_000)).toBe("2m 5s");
  });
});
