import { describe, expect, it } from "vitest";
import { describeFirstRun } from "./jobsFirstRun";
import type { JobSchedule } from "./jobsFormat";

const now = new Date(2026, 9, 11, 8, 0, 0); // Sun Oct 11 2026 08:00 local

const weekdays: JobSchedule = {
  mode: "calendar",
  atMinutes: 9 * 60,
  days: ["mon", "tue", "wed", "thu", "fri"],
};

const dayOf = (month: number, date: number) =>
  new Date(2026, month, date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

describe("describeFirstRun", () => {
  it("names the first slot and then how it repeats", () => {
    expect(describeFirstRun(weekdays, "First run", now)).toEqual({
      first: `First run ${dayOf(9, 12)} around 09:00`,
      then: "Then every weekday",
    });
  });

  it("leads with the next run when editing", () => {
    expect(describeFirstRun(weekdays, "Next run", now)?.first).toMatch(/^Next run /);
  });

  it("gives a window's range", () => {
    const run = describeFirstRun(
      { mode: "calendar", atMinutes: 9 * 60, untilMinutes: 11 * 60, days: [] },
      "First run",
      now,
    );
    expect(run).toEqual({
      first: `First run ${dayOf(9, 11)} between 09:00 and 11:00`,
      then: "Then every day",
    });
  });

  it("keeps the times when a day holds several", () => {
    const run = describeFirstRun(
      { mode: "calendar", atMinutes: 9 * 60, alsoAtMinutes: [17 * 60 + 30], days: ["mon", "thu"] },
      "First run",
      now,
    );
    expect(run?.then).toBe("Then on Mondays and Thursdays at 09:00 and 17:30");
  });

  it("only promises the earliest run for random days", () => {
    const run = describeFirstRun({ ...weekdays, pickDays: 2 }, "First run", now);
    expect(run?.first).toMatch(/^Earliest run /);
    expect(run?.then).toBe("Then on 2 random weekdays a week");
  });

  it("counts runs inside a window", () => {
    const run = describeFirstRun(
      { mode: "calendar", atMinutes: 9 * 60, untilMinutes: 17 * 60, times: 3, days: [] },
      "First run",
      now,
    );
    expect(run?.then).toBe("Then 3 times a day");
  });

  it("repeats a monthly rule", () => {
    const run = describeFirstRun(
      { mode: "calendar", atMinutes: 9 * 60, days: [], monthDays: [1, 15] },
      "First run",
      now,
    );
    expect(run?.first).toBe(`First run ${dayOf(9, 15)} around 09:00`);
    expect(run?.then).toBe("Then on the 1st and 15th of every month");
  });

  it("runs a one-off once", () => {
    const run = describeFirstRun(
      { mode: "calendar", atMinutes: 9 * 60, days: [], onDates: ["2026-10-20"] },
      "First run",
      now,
    );
    expect(run).toEqual({ first: `Runs once on ${dayOf(9, 20)} around 09:00` });
  });

  it("repeats an interval from now", () => {
    const run = describeFirstRun({ mode: "interval", everySecs: 6 * 3600 }, "First run", now);
    expect(run).toEqual({
      first: `First run ${dayOf(9, 11)} around 14:00`,
      then: "Then every 6 hours",
    });
  });

  it("runs a cron line on its minute", () => {
    const run = describeFirstRun({ mode: "cron", cron: "0 18 * * 5" }, "First run", now);
    expect(run).toEqual({
      first: `First run ${dayOf(9, 16)} at 18:00`,
      then: "Then at 18:00 on Fridays",
    });
  });

  it("has nothing to schedule for a manual job", () => {
    expect(describeFirstRun({ mode: "manual" }, "First run", now)).toEqual({
      first: "Runs only when you start it",
    });
  });
});
