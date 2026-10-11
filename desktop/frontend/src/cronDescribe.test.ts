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
    expect(rate("0 * * * *")).toBe("24 runs a day");
    expect(rate("0 9 1 * *")).toBe("12 runs a year");
  });

  it("says how far off a run is", () => {
    const now = 1_000_000;
    expect(cronRelative(now + 600, now)).toBe("in 10 minutes");
    expect(cronRelative(now + 3 * 3600, now)).toBe("in 3 hours");
    expect(cronRelative(now + 30 * 3600, now)).toBe("tomorrow");
    expect(cronRelative(now + 5.4 * 86400, now)).toBe("in 5 days");
  });
});
