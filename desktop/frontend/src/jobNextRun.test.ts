import { describe, expect, it } from "vitest";
import { nextRunLabel } from "./jobNextRun";

const now = new Date(2026, 9, 21, 15, 49);
const at = (d: Date) => Math.floor(d.getTime() / 1000);

describe("nextRunLabel", () => {
  it("says today and tomorrow by name", () => {
    expect(nextRunLabel(at(new Date(2026, 9, 21, 17, 0)), now)).toBe("Today 17:00");
    expect(nextRunLabel(at(new Date(2026, 9, 22, 9, 0)), now)).toBe("Tomorrow 09:00");
  });

  it("uses the weekday within a week and the date after", () => {
    const friday = new Date(2026, 9, 23, 17, 0);
    expect(nextRunLabel(at(friday), now)).toBe(
      `${friday.toLocaleDateString(undefined, { weekday: "long" })} 17:00`,
    );
    const later = new Date(2026, 10, 3, 9, 0);
    expect(nextRunLabel(at(later), now)).toBe(
      `${later.toLocaleDateString(undefined, { month: "short", day: "numeric" })} 09:00`,
    );
  });

  it("is empty with nothing scheduled and immediate when overdue", () => {
    expect(nextRunLabel(undefined, now)).toBe("");
    expect(nextRunLabel(at(new Date(2026, 9, 21, 15, 0)), now)).toBe("In a moment");
  });
});
