import { describe, expect, it } from "vitest";
import { parseCron } from "./cronExpr";
import { cronFrequency, cronRelative, describeCron, describeCronText, ordinal } from "./cronDescribe";

const text = (expr: string) => describeCronText(expr);

describe("describeCron", () => {
  it("reads fixed times as a clock", () => {
    expect(text("0 18 * * 5")).toBe("At 18:00 on Fridays");
    expect(text("30 9,17 * * 1-5")).toBe("At 09:30 and 17:30 on weekdays");
    expect(text("0 9 1,15 * *")).toBe("At 09:00 on the 1st and 15th");
    expect(text("0 0 1 1 *")).toBe("At 00:00 on the 1st in January");
  });

  it("reads repeating minutes and hours", () => {
    expect(text("*/15 * * * *")).toBe("Every 15 minutes");
    expect(text("*/15 9-17 * * 1-5")).toBe("Every 15 minutes from 09:00 through 17:59 on weekdays");
    expect(text("5 * * * *")).toBe("At minute 5 past every hour");
    expect(text("0 */2 * * *")).toBe("At minute 0 past every 2 hours");
    expect(text("0 9-17 * * 0,6")).toBe("At minute 0 past every hour from 9 through 17 on weekends");
  });

  it("says either day is enough when both are set", () => {
    expect(text("0 9 1 * mon")).toBe("At 09:00 on the 1st or on Mondays");
    expect(text("0 9 * */3 *")).toBe("At 09:00 every 3 months");
  });

  it("says a clock time with no days set runs every day", () => {
    expect(text("0 9 * * *")).toBe("At 09:00 every day");
    expect(text("@daily")).toBe("At 00:00 every day");
    expect(text("*/15 * * * *")).toBe("Every 15 minutes");
  });

  it("tags the words each field controls", () => {
    const parsed = parseCron("0 18 * * 5");
    if (!parsed.ok) throw new Error(parsed.error);
    const segments = describeCron(parsed.spec);
    expect(segments.find((s) => s.field === "hour")?.text).toBe("18");
    expect(segments.find((s) => s.field === "minute")?.text).toBe("00");
    expect(segments.find((s) => s.field === "dow")?.text).toBe("on Fridays");
  });

  it("has nothing to say about a broken line", () => {
    expect(text("0 25 * * *")).toBeNull();
  });
});

describe("cron helpers", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "31st",
    ]);
  });

  it("sums up how often a line runs", () => {
    const now = new Date(2026, 6, 10, 12).getTime() / 1000;
    const rate = (expr: string) => {
      const parsed = parseCron(expr);
      if (!parsed.ok) throw new Error(parsed.error);
      return cronFrequency(parsed.spec, now);
    };
    expect(rate("0 18 * * 5")).toBe("1 run a week");
    expect(rate("0 9 * * *")).toBe("1 run a day");
    expect(rate("0 * * * *")).toBe("24 runs a day");
    expect(rate("30 9 * * 1-5")).toBe("5 runs a week");
    expect(rate("*/15 9-17 * * 1-5")).toBe("36 runs a day, 5 days a week");
    expect(rate("0 9 1 * *")).toBe("1 run a month");
    expect(rate("0 9 1,15 * *")).toBe("2 runs a month");
    expect(rate("0 0 1 */3 *")).toBe("4 runs a year");
  });

  it("says how far off a run is, in calendar days past the next few hours", () => {
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime() / 1000;
    const now = at(11, 9, 10);
    expect(cronRelative(at(11, 9, 20), now)).toBe("in 10 minutes");
    expect(cronRelative(at(11, 12, 30), now)).toBe("in 3 hours");
    expect(cronRelative(at(12, 9, 0), now)).toBe("tomorrow");
    expect(cronRelative(at(12, 9, 15), now)).toBe("tomorrow");
    expect(cronRelative(at(13, 9, 0), now)).toBe("in 2 days");
    expect(cronRelative(at(12, 2, 0), at(11, 23, 0))).toBe("in 3 hours");
  });
});
