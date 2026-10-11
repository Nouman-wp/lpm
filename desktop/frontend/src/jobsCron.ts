// Carrying a schedule between the form and the cron editor: the cron line a
// form schedule matches, when cron can say it at all (it can't say a random
// time in a window, the first Monday, the last day, or a gap counted from the
// last run), and the form fields a cron line fills in.

import { formatMinutes, type JobDraft, type JobSchedule } from "./jobsFormat";
import { parseCron } from "./cronExpr";
import { draftToSchedule } from "./jobsScheduleDraft";
import { WEEKDAYS, type Weekday } from "./weekdays";

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

export function cronEquivalent(schedule: JobSchedule): string | null {
  if (schedule.mode === "cron") return schedule.cron;
  if (schedule.mode !== "calendar") return null;
  if (
    schedule.untilMinutes !== undefined ||
    schedule.pickDays ||
    (schedule.onDates?.length ?? 0) > 0 ||
    (schedule.nth && schedule.nthOf) ||
    schedule.lastDay ||
    schedule.shortMonths === "last"
  ) {
    return null;
  }

  const times = [schedule.atMinutes, ...(schedule.alsoAtMinutes ?? [])];
  const minutes = new Set(times.map((t) => t % 60));
  if (minutes.size > 1) return null;

  const hours = cronList(times.map((t) => Math.floor(t / 60)));
  const dom = (schedule.monthDays?.length ?? 0) > 0 ? cronList(schedule.monthDays ?? []) : "*";
  const days = schedule.days ?? [];
  const dow = days.length > 0 && days.length < 7 ? cronList(days.map((d) => CRON_DAY[d])) : "*";
  return `${[...minutes][0]} ${hours} ${dom} * ${dow}`;
}

// Where the cron editor starts when the form has nothing cron can say.
export const DEFAULT_CRON = "0 9 * * *";

// The most set times the form lists before a line is better left as cron.
const MAX_FORM_TIMES = 6;

// The form's schedule as a cron line, or null when cron can't say it.
export function formCron(draft: JobDraft): string | null {
  const schedule = draftToSchedule({ ...draft, scheduleKind: "form" });
  return schedule ? cronEquivalent(schedule) : null;
}

// The form fields that say what a cron line says — set times on some weekdays
// or dates of the month — or null when the form has no way to put it.
export function cronFormPatch(cron: string): Partial<JobDraft> | null {
  const parsed = parseCron(cron);
  if (!parsed.ok) return null;
  const { sets, domAny, dowAny } = parsed.spec;
  if (sets.minute.size !== 1 || sets.hour.size > MAX_FORM_TIMES || sets.month.size !== 12) {
    return null;
  }
  const minute = [...sets.minute][0];
  const [time, ...moreTimes] = [...sets.hour]
    .sort((a, b) => a - b)
    .map((h) => formatMinutes(h * 60 + minute));
  const base: Partial<JobDraft> = {
    scheduleMode: "time",
    time,
    moreTimes,
    randomWindow: false,
    randomDays: false,
  };
  const allDates = sets.dom.size === 31;
  const allDays = sets.dow.size === 7;
  // Two restricted day fields match a day when either does (the Vixie rule),
  // so a full one means every day and two partial ones can't be put as one.
  const either = !domAny && !dowAny;
  if ((allDates && allDays) || (either && (allDates || allDays))) {
    return { ...base, dayRule: "week", days: [] };
  }
  if (either) return null;
  if (allDates) {
    return {
      ...base,
      dayRule: "week",
      days: WEEKDAYS.filter((d) => sets.dow.has(CRON_DAY[d])),
    };
  }
  if (allDays) {
    return {
      ...base,
      dayRule: "dates",
      monthDates: [...sets.dom].sort((a, b) => a - b),
      lastDay: false,
      shortMonths: "skip",
    };
  }
  return null;
}
