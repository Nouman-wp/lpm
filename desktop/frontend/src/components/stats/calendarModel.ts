import type { DailyUsage } from "../../types";
import { addDays, daysBetween, monthName, weekStart, weekdayIndex } from "./statsDates";

export interface CalendarCell {
  date: string;
  /** Before the history starts or after today: drawn as a gap. */
  outside: boolean;
  level: number;
  day: DailyUsage | null;
}

export interface CalendarModel {
  weeks: CalendarCell[][];
  months: Map<number, string>;
  clipped: boolean;
  streak: number;
  longest: number;
  active: number;
  span: number;
  busiestWeekday: number | null;
}

// A year of weeks; longer histories show their latest year.
const MAX_WEEKS = 53;

function levelOf(thresholds: number[]): (value: number) => number {
  return (value) => {
    if (value <= 0) return 0;
    const above = thresholds.findIndex((threshold) => value <= threshold);
    return above === -1 ? 4 : above + 1;
  };
}

function quartiles(values: number[]): number[] {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 0, 0];
  return [0.25, 0.5, 0.75].map((p) => sorted[Math.floor(p * (sorted.length - 1))]);
}

function runs(days: DailyUsage[]): { streak: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.totalTokens > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // A day that hasn't had usage yet doesn't break the streak until it's over.
  const settled = days[days.length - 1]?.totalTokens ? days : days.slice(0, -1);
  let streak = 0;
  for (let i = settled.length - 1; i >= 0 && settled[i].totalTokens > 0; i--) streak++;
  return { streak, longest };
}

function busiest(days: DailyUsage[]): number | null {
  const totals = new Array(7).fill(0);
  for (const day of days) totals[weekdayIndex(day.date)] += day.totalTokens;
  const top = Math.max(...totals);
  return top > 0 ? totals.indexOf(top) : null;
}

/** `days` run without gaps from the first day shown to today. */
export function calendarModel(days: DailyUsage[], today: string): CalendarModel {
  const lastWeek = weekStart(today);
  const earliest = addDays(lastWeek, -(MAX_WEEKS - 1) * 7);
  const shown = days.filter((day) => day.date >= earliest);
  const first = shown[0]?.date ?? today;
  const byDate = new Map(shown.map((day) => [day.date, day]));
  const level = levelOf(quartiles(shown.map((day) => day.totalTokens)));
  const weeks: CalendarCell[][] = [];
  const months = new Map<number, string>();
  for (let start = weekStart(first); start <= lastWeek; start = addDays(start, 7)) {
    const column = weeks.length;
    const cells = Array.from({ length: 7 }, (_, row) => {
      const date = addDays(start, row);
      const day = byDate.get(date) ?? null;
      return {
        date,
        outside: date < first || date > today,
        level: level(day?.totalTokens ?? 0),
        day,
      };
    });
    const monthStart = cells.find((cell) => !cell.outside && cell.date.endsWith("-01"));
    if (monthStart) months.set(column, monthName(monthStart.date));
    weeks.push(cells);
  }
  if (!months.has(0) && ![1, 2].some((column) => months.has(column))) {
    months.set(0, monthName(first));
  }
  return {
    weeks,
    months,
    clipped: shown.length < days.length,
    ...runs(days),
    active: days.filter((day) => day.totalTokens > 0).length,
    span: days.length ? daysBetween(days[0].date, today) + 1 : 0,
    busiestWeekday: busiest(days),
  };
}
