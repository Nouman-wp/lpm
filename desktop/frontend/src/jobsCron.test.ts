import { describe, expect, it } from "vitest";
import { cronEquivalent, cronFormPatch, formCron } from "./jobsCron";
import { defaultJobDraft, describeDraftSchedule, type JobSchedule } from "./jobsFormat";

const calendar = (over: Partial<Extract<JobSchedule, { mode: "calendar" }>>): JobSchedule => ({
  mode: "calendar",
  atMinutes: 540,
  days: [],
  ...over,
});

describe("cronEquivalent", () => {
  it("writes the cron line for times, weekdays and dates of the month", () => {
    expect(cronEquivalent(calendar({ atMinutes: 1080, days: ["fri"] }))).toBe("0 18 * * 5");
    expect(cronEquivalent(calendar({ alsoAtMinutes: [1020], monthDays: [1, 15] }))).toBe(
      "0 9,17 1,15 * *",
    );
    expect(
      cronEquivalent(calendar({ atMinutes: 570, days: ["mon", "tue", "wed", "thu", "fri"] })),
    ).toBe("30 9 * * 1-5");
    expect(cronEquivalent(calendar({ days: ["sat", "sun"] }))).toBe("0 9 * * 0,6");
    expect(cronEquivalent(calendar({ monthDays: [31] }))).toBe("0 9 31 * *");
  });

  it("has none for what cron can't say", () => {
    expect(cronEquivalent(calendar({ alsoAtMinutes: [1050] }))).toBeNull();
    expect(cronEquivalent(calendar({ nth: "first", nthOf: "mon" }))).toBeNull();
    expect(cronEquivalent(calendar({ monthDays: [1], lastDay: true }))).toBeNull();
    expect(cronEquivalent(calendar({ monthDays: [31], shortMonths: "last" }))).toBeNull();
    expect(cronEquivalent(calendar({ onDates: ["2026-10-20"] }))).toBeNull();
    expect(cronEquivalent(calendar({ untilMinutes: 1020 }))).toBeNull();
    expect(cronEquivalent(calendar({ days: ["mon", "tue"], pickDays: 1 }))).toBeNull();
    expect(cronEquivalent({ mode: "interval", everySecs: 1800 })).toBeNull();
    expect(cronEquivalent({ mode: "manual" })).toBeNull();
  });

  it("passes a cron schedule through as written", () => {
    expect(cronEquivalent({ mode: "cron", cron: "*/15 9-17 * * mon-fri" })).toBe(
      "*/15 9-17 * * mon-fri",
    );
  });
});

describe("form and cron", () => {
  const form = (patch: ReturnType<typeof cronFormPatch>) =>
    describeDraftSchedule({ ...defaultJobDraft(), ...patch });

  it("writes the form as a cron line when it can", () => {
    expect(formCron(defaultJobDraft())).toBe("0 9 * * *");
    expect(formCron({ ...defaultJobDraft(), days: ["fri"], time: "18:00" })).toBe("0 18 * * 5");
    expect(formCron({ ...defaultJobDraft(), scheduleMode: "manual" })).toBeNull();
    // The cron line in use doesn't stand in for the form.
    expect(formCron({ ...defaultJobDraft(), scheduleKind: "cron", cron: "0 7 * * *" })).toBe(
      "0 9 * * *",
    );
  });

  it("fills the form in from set times on weekdays or dates", () => {
    expect(form(cronFormPatch("0 18 * * 5"))).toBe("Fridays at 18:00");
    expect(form(cronFormPatch("30 9,17 * * 1-5"))).toBe("Weekdays at 09:30 and 17:30");
    expect(form(cronFormPatch("@daily"))).toBe("Every day at 00:00");
    expect(form(cronFormPatch("0 8 1,15 * *"))).toBe("On the 1st and 15th of every month at 08:00");
    // Either restricted day field is enough, so a full one is every day.
    expect(form(cronFormPatch("0 9 1-31 * 1"))).toBe("Every day at 09:00");
    expect(cronFormPatch("0 18 * * 5")).toMatchObject({ randomWindow: false, randomDays: false });
  });

  it("leaves the form alone for what it can't say", () => {
    expect(cronFormPatch("*/15 9-17 * * 1-5")).toBeNull();
    expect(cronFormPatch("0 9 * 1 *")).toBeNull();
    expect(cronFormPatch("0 9 1 * 1")).toBeNull();
    expect(cronFormPatch("0 9 */2 * 1")).toBeNull();
    expect(cronFormPatch("0 * * * *")).toBeNull();
    expect(cronFormPatch("not cron")).toBeNull();
  });
});
