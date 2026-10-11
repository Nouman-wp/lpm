import { describe, expect, it } from "vitest";
import {
  dateRuleMatches,
  dateRulePhrase,
  monthDatesPhrase,
  readDaysValue,
  writeDaysValue,
  type DateRuleFields,
} from "./jobsScheduleRules";

const matchingDays = (rule: DateRuleFields, year: number, month: number) => {
  const out: number[] = [];
  for (let d = 1; d <= 31; d++) {
    const day = new Date(year, month, d);
    if (day.getMonth() === month && dateRuleMatches(rule, day)) out.push(d);
  }
  return out;
};

describe("readDaysValue / writeDaysValue", () => {
  it("tells weekdays, dates, positions and calendar dates apart", () => {
    expect(readDaysValue(["thu", "mon"])).toEqual({ kind: "week", days: ["mon", "thu"] });
    expect(readDaysValue([15, 1, "last"])).toEqual({ kind: "dates", dates: [1, 15], last: true });
    expect(readDaysValue("first mon")).toEqual({ kind: "nth", nth: "first", of: "mon" });
    expect(readDaysValue("last weekday")).toEqual({ kind: "nth", nth: "last", of: "weekday" });
    expect(readDaysValue(["2026-10-20"])).toEqual({ kind: "once", dates: ["2026-10-20"] });
    expect(readDaysValue(undefined)).toEqual({ kind: "week", days: [] });
    expect(readDaysValue("fifth mon")).toEqual({ kind: "week", days: [] });
  });

  it("writes each kind the way the backend reads it", () => {
    expect(writeDaysValue({ kind: "week", days: ["thu", "mon"] })).toEqual(["mon", "thu"]);
    expect(writeDaysValue({ kind: "week", days: [] })).toBeUndefined();
    expect(writeDaysValue({ kind: "dates", dates: [15, 1], last: true })).toEqual([1, 15, "last"]);
    expect(writeDaysValue({ kind: "nth", nth: "second", of: "fri" })).toBe("second fri");
    expect(writeDaysValue({ kind: "once", dates: ["2026-10-20"] })).toEqual(["2026-10-20"]);
  });
});

describe("dateRuleMatches", () => {
  it("skips or moves a date a short month lacks", () => {
    expect(matchingDays({ monthDays: [31] }, 2026, 3)).toEqual([]);
    expect(matchingDays({ monthDays: [31], shortMonths: "last" }, 2026, 3)).toEqual([30]);
    expect(matchingDays({ monthDays: [30], shortMonths: "last" }, 2026, 1)).toEqual([28]);
  });

  it("finds positions in the month", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    expect(matchingDays({ nth: "first", nthOf: "mon" }, 2026, 9)).toEqual([5]);
    expect(matchingDays({ nth: "last", nthOf: "fri" }, 2026, 9)).toEqual([30]);
    expect(matchingDays({ nth: "last", nthOf: "weekday" }, 2026, 9)).toEqual([30]);
    expect(matchingDays({ nth: "first", nthOf: "weekday" }, 2026, 10)).toEqual([2]);
    expect(matchingDays({ nth: "last", nthOf: "day" }, 2028, 1)).toEqual([29]);
  });
});

describe("phrases", () => {
  it("names dates of the month and positions", () => {
    expect(monthDatesPhrase([15, 1, 22], true)).toBe("the 1st, 15th, 22nd and last day");
    expect(dateRulePhrase({ monthDays: [1, 15] })).toBe("on the 1st and 15th of every month");
    expect(dateRulePhrase({ nth: "first", nthOf: "mon" })).toBe("on the first Monday of every month");
    expect(dateRulePhrase({ nth: "last", nthOf: "weekday" })).toBe(
      "on the last weekday of every month",
    );
  });
});
