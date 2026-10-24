import { shortUsageDate } from "../../agentUsageFormat";

// Calendar math on the "YYYY-MM-DD" dates the stats carry, done in UTC so a
// daylight-saving change never makes a day 23 or 25 hours long.

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

function parse(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function format(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function localDate(at: Date = new Date()): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function addDays(date: string, days: number): string {
  return format(parse(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

/** 0 for Monday through 6 for Sunday. */
export function weekdayIndex(date: string): number {
  return (new Date(parse(date)).getUTCDay() + 6) % 7;
}

export function isWeekend(date: string): boolean {
  return weekdayIndex(date) >= 5;
}

export function weekStart(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Local midnight at the start of `date`, in epoch millis. */
export function dayStartMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

const noon = (date: string) => new Date(`${date}T12:00:00`);

export function weekdayDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(noon(date));
}

export function monthName(date: string, withYear = false): string {
  return new Intl.DateTimeFormat(undefined, {
    month: withYear ? "long" : "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(noon(date));
}

export function weekdayName(index: number): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    noon(addDays("2024-01-01", index)),
  );
}

export function rangeLabel(from: string, to: string): string {
  return from === to ? shortUsageDate(from) : `${shortUsageDate(from)} – ${shortUsageDate(to)}`;
}
