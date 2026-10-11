// The cron line a schedule matches, for anyone who thinks in cron — or why
// there isn't one: lpm's schedules say things cron can't (a random time in a
// window, the first Monday, the last day, a gap counted from the last run).

import type { JobSchedule } from "./jobsFormat";
import { nthOfLabel } from "./jobsScheduleRules";
import type { Weekday } from "./weekdays";

export type CronEquivalent = { cron: string } | { reason: string };

const CRON_DAY: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

// "1-5", "0,6", "9,17", "1,15" — runs of three or more as a range.
function cronList(values: number[]): string {
  const v = [...new Set(values)].sort((a, b) => a - b);
  const out: string[] = [];
  let i = 0;
  while (i < v.length) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    if (j - i >= 2) out.push(`${v[i]}-${v[j]}`);
    else for (let k = i; k <= j; k++) out.push(String(v[k]));
    i = j + 1;
  }
  return out.join(",");
}

export function cronEquivalent(schedule: JobSchedule): CronEquivalent {
  if (schedule.mode === "manual") return { reason: "Manual automations have no schedule" };
  if (schedule.mode === "interval") {
    return { reason: "An interval counts from the last run, which cron can't do" };
  }
  if (schedule.untilMinutes !== undefined) {
    return { reason: "A random time in a window has no cron form" };
  }
  if (schedule.pickDays) return { reason: "Random days of the week have no cron form" };
  if ((schedule.onDates?.length ?? 0) > 0) return { reason: "A one-off date has no cron form" };
  if (schedule.nth && schedule.nthOf) {
    return { reason: `Cron can't say “the ${schedule.nth} ${nthOfLabel(schedule.nthOf)}”` };
  }
  if (schedule.lastDay || schedule.shortMonths === "last") {
    return { reason: "Cron has no “last day of the month”" };
  }

  const times = [schedule.atMinutes, ...(schedule.alsoAtMinutes ?? [])];
  const minutes = new Set(times.map((t) => t % 60));
  if (minutes.size > 1) return { reason: "Times on different minutes need more than one cron line" };

  const hours = cronList(times.map((t) => Math.floor(t / 60)));
  const dom = (schedule.monthDays?.length ?? 0) > 0 ? cronList(schedule.monthDays ?? []) : "*";
  const days = schedule.days ?? [];
  const dow = days.length > 0 && days.length < 7 ? cronList(days.map((d) => CRON_DAY[d])) : "*";
  return { cron: `${[...minutes][0]} ${hours} ${dom} * ${dow}` };
}
