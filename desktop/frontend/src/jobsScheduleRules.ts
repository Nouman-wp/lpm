// The calendar vocabulary beyond "these weekdays": dates of the month, a
// position in the month ("the first Monday"), one-off calendar dates, and the
// hours and days an interval job is held to. Mirrors jobcal.rs, which owns the
// YAML shape: `days` holds weekday names, dates (`[1, 15, last]`), calendar
// dates (`[2026-10-20]`) or one position (`first mon`).

import { WEEKDAYS, type Weekday } from "./weekdays";

export type NthWord = "first" | "second" | "third" | "fourth" | "last";
export type NthOf = Weekday | "day" | "weekday";

export const NTH_WORDS: NthWord[] = ["first", "second", "third", "fourth", "last"];

const DAY_LONG: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type DaysValue =
  | { kind: "week"; days: Weekday[] }
  | { kind: "dates"; dates: number[]; last: boolean }
  | { kind: "nth"; nth: NthWord; of: NthOf }
  | { kind: "once"; dates: string[] };

// What the backend reports for a calendar schedule's days when they aren't
// weekdays.
export interface DateRuleFields {
  monthDays?: number[];
  lastDay?: boolean;
  shortMonths?: "last";
  nth?: NthWord;
  nthOf?: NthOf;
  onDates?: string[];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(iso: string): Date | null {
  const m = ISO_DATE.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

export function isoDate(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function readNth(text: string): DaysValue | null {
  const [nth, of, extra] = text.trim().toLowerCase().split(/\s+/);
  if (extra !== undefined || !NTH_WORDS.includes(nth as NthWord)) return null;
  const isOf = of === "day" || of === "weekday" || WEEKDAYS.includes(of as Weekday);
  return isOf ? { kind: "nth", nth: nth as NthWord, of: of as NthOf } : null;
}

// Reads a YAML `days` value leniently: whatever doesn't fit is dropped, so the
// editor always opens on something it can show.
export function readDaysValue(value: unknown): DaysValue {
  if (typeof value === "string" && /\s/.test(value.trim())) {
    return readNth(value) ?? { kind: "week", days: [] };
  }
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const dates: number[] = [];
  const once: string[] = [];
  const week = new Set<string>();
  let last = false;
  for (const item of items) {
    const t = String(item).trim().toLowerCase();
    if (t === "last") last = true;
    else if (/^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31) dates.push(Number(t));
    else if (parseIsoDate(t)) once.push(t);
    else week.add(t);
  }
  if (once.length > 0) return { kind: "once", dates: [...new Set(once)].sort() };
  if (dates.length > 0 || last) {
    return { kind: "dates", dates: [...new Set(dates)].sort((a, b) => a - b), last };
  }
  return { kind: "week", days: WEEKDAYS.filter((d) => week.has(d)) };
}

export function writeDaysValue(value: DaysValue): unknown {
  switch (value.kind) {
    case "week":
      return value.days.length > 0 && value.days.length < 7
        ? WEEKDAYS.filter((d) => value.days.includes(d))
        : undefined;
    case "dates": {
      const dates: (number | string)[] = [...new Set(value.dates)].sort((a, b) => a - b);
      if (value.last) dates.push("last");
      return dates;
    }
    case "nth":
      return `${value.nth} ${value.of}`;
    case "once":
      return value.dates;
  }
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function nthOfLabel(of: NthOf): string {
  return of === "day" || of === "weekday" ? of : DAY_LONG[of];
}

// "the 1st, 15th and last day".
export function monthDatesPhrase(dates: number[], last: boolean): string {
  const words = [...dates].sort((a, b) => a - b).map(ordinal);
  if (last) words.push("last day");
  return `the ${joinWords(words)}`;
}

export function onDatePhrase(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function hasDateRule(s: DateRuleFields): boolean {
  return (
    (s.monthDays?.length ?? 0) > 0 ||
    s.lastDay === true ||
    s.nth !== undefined ||
    (s.onDates?.length ?? 0) > 0
  );
}

export function isOnce(s: DateRuleFields): boolean {
  return (s.onDates?.length ?? 0) > 0;
}

// "on the 1st and 15th of every month", "on the first Monday of every month",
// "on Tue, Oct 20, 2026".
export function dateRulePhrase(s: DateRuleFields): string {
  if (isOnce(s)) return `on ${joinWords((s.onDates ?? []).map(onDatePhrase))}`;
  if (s.nth && s.nthOf) return `on the ${s.nth} ${nthOfLabel(s.nthOf)} of every month`;
  return `on ${monthDatesPhrase(s.monthDays ?? [], s.lastDay === true)} of every month`;
}

function daysInMonth(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
}

function isWorkday(d: Date): boolean {
  return d.getDay() !== 0 && d.getDay() !== 6;
}

function nthMatches(day: Date, nth: NthWord, of: NthOf): boolean {
  const dim = daysInMonth(day);
  const date = day.getDate();
  const index = NTH_WORDS.indexOf(nth) + 1;
  const last = nth === "last";
  if (of === "day") return date === (last ? dim : index);
  if (of === "weekday") {
    if (!isWorkday(day)) return false;
    const workdays: number[] = [];
    for (let n = 1; n <= dim; n++) {
      if (isWorkday(new Date(day.getFullYear(), day.getMonth(), n))) workdays.push(n);
    }
    return date === (last ? workdays[workdays.length - 1] : workdays[index - 1]);
  }
  if (WEEKDAYS[(day.getDay() + 6) % 7] !== of) return false;
  return last ? date + 7 > dim : Math.floor((date - 1) / 7) + 1 === index;
}

export function dateRuleMatches(s: DateRuleFields, day: Date): boolean {
  if (isOnce(s)) return (s.onDates ?? []).includes(isoDate(day));
  if (s.nth && s.nthOf) return nthMatches(day, s.nth, s.nthOf);
  const dim = daysInMonth(day);
  const date = day.getDate();
  const dates = s.monthDays ?? [];
  if (dates.includes(date)) return true;
  if (date !== dim) return false;
  return s.lastDay === true || (s.shortMonths === "last" && dates.some((d) => d > dim));
}
