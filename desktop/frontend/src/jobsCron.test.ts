import { describe, expect, it } from "vitest";
import { cronEquivalent } from "./jobsCron";
import type { JobSchedule } from "./jobsFormat";

const calendar = (over: Partial<Extract<JobSchedule, { mode: "calendar" }>>): JobSchedule => ({
  mode: "calendar",
  atMinutes: 540,
  days: [],
  ...over,
});

describe("cronEquivalent", () => {
  it("writes the cron line for times, weekdays and dates of the month", () => {
    expect(cronEquivalent(calendar({ atMinutes: 1080, days: ["fri"] }))).toEqual({ cron: "0 18 * * 5" });
    expect(cronEquivalent(calendar({ alsoAtMinutes: [1020], monthDays: [1, 15] }))).toEqual({
      cron: "0 9,17 1,15 * *",
    });
    expect(
      cronEquivalent(calendar({ atMinutes: 570, days: ["mon", "tue", "wed", "thu", "fri"] })),
    ).toEqual({ cron: "30 9 * * 1-5" });
    expect(cronEquivalent(calendar({ days: ["sat", "sun"] }))).toEqual({ cron: "0 9 * * 0,6" });
    expect(cronEquivalent(calendar({ monthDays: [31] }))).toEqual({ cron: "0 9 31 * *" });
  });

  it("explains what cron can't say", () => {
    const reason = (s: JobSchedule) => {
      const result = cronEquivalent(s);
      return "reason" in result ? result.reason : null;
    };
    expect(reason(calendar({ alsoAtMinutes: [1050] }))).toBe(
      "Times on different minutes need more than one cron line",
    );
    expect(reason(calendar({ nth: "first", nthOf: "mon" }))).toBe("Cron can't say “the first Monday”");
    expect(reason(calendar({ monthDays: [1], lastDay: true }))).not.toBeNull();
    expect(reason(calendar({ monthDays: [31], shortMonths: "last" }))).not.toBeNull();
    expect(reason(calendar({ onDates: ["2026-10-20"] }))).not.toBeNull();
    expect(reason(calendar({ untilMinutes: 1020 }))).not.toBeNull();
    expect(reason(calendar({ days: ["mon", "tue"], pickDays: 1 }))).not.toBeNull();
    expect(reason({ mode: "interval", everySecs: 1800 })).not.toBeNull();
  });
});
