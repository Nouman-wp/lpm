import { describe, expect, it } from "vitest";
import { bucketDays, calendarDays, defaultGrain, grainChoices } from "./chartBuckets";
import { axisLabels, peakIndex } from "./chartAxis";
import { day } from "./statsFixtures";

// 2026-10-24 is a Saturday.
const TODAY = "2026-10-24";

describe("calendarDays", () => {
  it("fills the period's quiet days with zeros", () => {
    const days = calendarDays([day("2026-10-20", [{ project: "a", total: 10 }])], 7, TODAY);
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(days.map((d) => d.totalTokens)).toEqual([0, 0, 10, 0, 0, 0, 0]);
  });

  it("starts all time at the first day with usage", () => {
    const days = calendarDays([day("2026-06-09", [{ project: "a", total: 1 }])], 0, TODAY);
    expect(days[0].date).toBe("2026-06-09");
    expect(days).toHaveLength(138);
  });
});

describe("bucketDays", () => {
  const days = calendarDays(
    [
      day("2026-10-11", [{ project: "a", total: 5 }]),
      day("2026-10-12", [{ project: "a", total: 7 }]),
      day("2026-10-24", [{ project: "b", total: 3, provider: "codex" }]),
    ],
    14,
    TODAY,
  );

  it("groups weeks Monday to Sunday and marks the one holding today", () => {
    const weeks = bucketDays(days, "week", TODAY);
    expect(weeks.map((w) => [w.date, w.end, w.totalTokens, w.partial])).toEqual([
      ["2026-10-11", "2026-10-11", 5, false],
      ["2026-10-12", "2026-10-18", 7, false],
      ["2026-10-19", "2026-10-24", 3, true],
    ]);
    expect(weeks[2].codexTokens).toBe(3);
  });

  it("groups months and keeps each day as its own bar by default", () => {
    expect(bucketDays(days, "month", TODAY)).toHaveLength(1);
    const daily = bucketDays(days, "day", TODAY);
    expect(daily).toHaveLength(14);
    expect(daily[13].partial).toBe(true);
  });

  it("picks weeks past 45 days and offers a choice from four weeks", () => {
    expect(defaultGrain(30)).toBe("day");
    expect(defaultGrain(138)).toBe("week");
    expect(grainChoices(7)).toEqual(["day"]);
    expect(grainChoices(30)).toEqual(["day", "week", "month"]);
  });
});

describe("chart axis", () => {
  it("labels Mondays on a month of days and finds the peak", () => {
    const days = calendarDays(
      [
        day("2026-10-14", [{ project: "a", total: 50 }]),
        day("2026-10-15", [{ project: "a", total: 9 }]),
      ],
      30,
      TODAY,
    );
    const buckets = bucketDays(days, "day", TODAY);
    const labelled = axisLabels(buckets, "day").map((label) => buckets[label.index].date);
    expect(labelled).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(buckets[peakIndex(buckets) ?? -1].date).toBe("2026-10-14");
  });
});
