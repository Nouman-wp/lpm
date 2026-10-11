import { describe, expect, it } from "vitest";
import {
  buildJobPayload,
  defaultJobDraft,
  describeDraftSchedule,
  payloadToDraft,
  type JobDraft,
} from "./jobsFormat";
import { validateDraftSchedule } from "./jobsScheduleDraft";
import { repeatOf, repeatPatch } from "./jobsRepeat";

const draft = (over: Partial<JobDraft>): JobDraft => ({
  ...defaultJobDraft(),
  label: "Job",
  runMode: "cmd",
  cmd: "make",
  ...over,
});

const roundTrip = (d: JobDraft) => payloadToDraft(buildJobPayload(d));

describe("several times a day", () => {
  const twice = draft({ time: "17:30", moreTimes: ["09:00"], days: ["mon", "thu"] });

  it("writes a sorted list of times and reads it back", () => {
    expect(buildJobPayload(twice).schedule).toEqual({
      at: ["09:00", "17:30"],
      days: ["mon", "thu"],
    });
    expect(roundTrip(twice)).toEqual({ ...twice, time: "09:00", moreTimes: ["17:30"] });
    expect(describeDraftSchedule(twice)).toBe("Mondays and Thursdays at 09:00 and 17:30");
  });

  it("keeps the times at least 5 minutes apart", () => {
    expect(validateDraftSchedule(draft({ time: "09:00", moreTimes: ["09:03"] }))).toBe(
      "Keep the times at least 5 minutes apart.",
    );
    expect(validateDraftSchedule(draft({ time: "09:00", moreTimes: [""] }))).toBe(
      "Pick a valid time.",
    );
  });
});

describe("monthly", () => {
  it("round-trips dates of the month with the last day", () => {
    const d = draft({ dayRule: "dates", monthDates: [1, 15], lastDay: true });
    expect(buildJobPayload(d).schedule).toEqual({ at: "09:00", days: [1, 15, "last"] });
    expect(roundTrip(d)).toEqual(d);
    expect(describeDraftSchedule(d)).toBe("On the 1st, 15th and last day of every month at 09:00");
  });

  it("writes what a short month does only when a picked date needs it", () => {
    const d = draft({ dayRule: "dates", monthDates: [31], shortMonths: "last" });
    expect(buildJobPayload(d).schedule).toEqual({ at: "09:00", days: [31], shortMonths: "last" });
    expect(roundTrip(d)).toEqual(d);
    const early = draft({ dayRule: "dates", monthDates: [5], shortMonths: "last" });
    expect(buildJobPayload(early).schedule).toEqual({ at: "09:00", days: [5] });
  });

  it("round-trips a position in the month", () => {
    const d = draft({ dayRule: "nth", nth: "last", nthOf: "fri", time: "16:00" });
    expect(buildJobPayload(d).schedule).toEqual({ at: "16:00", days: "last fri" });
    expect(roundTrip(d)).toEqual(d);
    expect(describeDraftSchedule(d)).toBe("On the last Friday of every month at 16:00");
  });

  it("needs at least one date", () => {
    expect(validateDraftSchedule(draft({ dayRule: "dates", monthDates: [] }))).toBe(
      "Pick at least one date.",
    );
  });
});

describe("once", () => {
  const now = new Date(2026, 9, 11, 12, 0);

  it("round-trips a calendar date", () => {
    const d = draft({ dayRule: "once", onceDate: "2026-10-20", time: "14:00" });
    expect(buildJobPayload(d).schedule).toEqual({ at: "14:00", days: ["2026-10-20"] });
    expect(roundTrip(d)).toEqual(d);
    expect(describeDraftSchedule(d)).toMatch(/^Once, on .+ at 14:00$/);
  });

  it("refuses a date that has passed", () => {
    expect(validateDraftSchedule(draft({ dayRule: "once", onceDate: "2026-10-11", time: "11:00" }), now)).toBe(
      "That date has already passed.",
    );
    expect(validateDraftSchedule(draft({ dayRule: "once", onceDate: "2026-10-11", time: "13:00" }), now)).toBeNull();
    expect(validateDraftSchedule(draft({ dayRule: "once", onceDate: "" }), now)).toBe("Pick a date.");
  });
});

describe("interval held to hours and days", () => {
  const limited = draft({
    scheduleMode: "interval",
    intervalValue: 30,
    intervalUnit: "minutes",
    intervalWindow: true,
    intervalFrom: "09:00",
    intervalUntil: "18:00",
    intervalDays: ["mon", "tue", "wed", "thu", "fri"],
  });

  it("writes the window and days beside the gap and reads them back", () => {
    expect(buildJobPayload(limited).schedule).toEqual({
      every: "30m",
      at: "09:00",
      until: "18:00",
      days: ["mon", "tue", "wed", "thu", "fri"],
    });
    expect(roundTrip(limited)).toEqual(limited);
    expect(describeDraftSchedule(limited)).toBe(
      "Every 30 minutes between 09:00 and 18:00 on weekdays",
    );
  });

  it("needs a window that ends after it starts", () => {
    expect(validateDraftSchedule({ ...limited, intervalUntil: "08:00" })).toBe(
      "The window has to end after it starts.",
    );
  });
});

describe("repeat", () => {
  it("derives the repeat from the draft and switches between them", () => {
    const now = new Date(2026, 9, 11);
    const d = draft({});
    expect(repeatOf(d)).toBe("daily");
    expect(repeatOf({ ...d, ...repeatPatch(d, "weekly") })).toBe("weekly");
    expect(repeatOf({ ...d, ...repeatPatch(d, "monthly") })).toBe("monthly");
    const once = { ...d, ...repeatPatch(d, "once", now) };
    expect(repeatOf(once)).toBe("once");
    expect(once.onceDate).toBe("2026-10-12");
    expect(repeatOf({ ...once, ...repeatPatch(once, "daily") })).toBe("daily");
  });
});

describe("cron", () => {
  const cron = draft({ scheduleKind: "cron", cron: "  0  18 * * fri " });

  it("writes the line alone and reads it back", () => {
    expect(buildJobPayload(cron).schedule).toEqual({ cron: "0 18 * * fri" });
    expect(roundTrip(cron)).toEqual({ ...cron, cron: "0 18 * * fri" });
    expect(describeDraftSchedule(cron)).toBe("At 18:00 on Fridays");
  });

  it("keeps the form's fields while the line is in use", () => {
    const d = { ...cron, scheduleMode: "manual" as const };
    expect(describeDraftSchedule(d)).toBe("At 18:00 on Fridays");
    expect(repeatOf(d)).toBe("manual");
  });

  it("reports what's wrong with the line", () => {
    expect(validateDraftSchedule(cron)).toBeNull();
    expect(validateDraftSchedule({ ...cron, cron: "" })).toBe("Enter a cron line.");
    expect(validateDraftSchedule({ ...cron, cron: "* * * * *" })).toBe(
      "A cron job can run at most every 5 minutes.",
    );
    expect(describeDraftSchedule({ ...cron, cron: "0 25 * * *" })).toBe("");
  });
});
