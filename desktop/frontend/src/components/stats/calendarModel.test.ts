import { describe, expect, it } from "vitest";
import { calendarModel } from "./calendarModel";
import { calendarDays } from "./chartBuckets";
import { day } from "./statsFixtures";

// 2026-10-24 is a Saturday.
const TODAY = "2026-10-24";

const used = (dates: string[]) =>
  calendarDays(
    dates.map((date) => day(date, [{ project: "a", total: 10 }])),
    30,
    TODAY,
  );

describe("calendarModel", () => {
  it("lays weeks out Monday first and leaves days outside the period blank", () => {
    const model = calendarModel(used(["2026-10-01"]), TODAY);
    expect(model.weeks[0][0].date).toBe("2026-09-21");
    expect(model.weeks[0].map((cell) => cell.outside)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    const last = model.weeks[model.weeks.length - 1];
    expect(last[5].date).toBe(TODAY);
    expect(last[6].outside).toBe(true);
  });

  it("keeps a streak alive through a today without usage yet", () => {
    const model = calendarModel(
      used(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]),
      TODAY,
    );
    expect(model.streak).toBe(4);
    expect(model.longest).toBe(4);
    expect(model.active).toBe(4);
    expect(model.span).toBe(30);
  });

  it("breaks the streak on a quiet day and names the busiest weekday", () => {
    const model = calendarModel(used(["2026-10-12", "2026-10-13", "2026-10-19", TODAY]), TODAY);
    expect(model.streak).toBe(1);
    expect(model.longest).toBe(2);
    expect(model.busiestWeekday).toBe(0);
  });

  it("shades quiet days apart from busy ones", () => {
    const model = calendarModel(used(["2026-10-20"]), TODAY);
    const cells = model.weeks.flat();
    expect(cells.find((cell) => cell.date === "2026-10-20")?.level).toBeGreaterThan(0);
    expect(cells.find((cell) => cell.date === "2026-10-21")?.level).toBe(0);
  });
});
