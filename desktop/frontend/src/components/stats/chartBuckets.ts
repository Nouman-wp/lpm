import type { DailyUsage } from "../../types";
import { addDay, emptyDay } from "./usageFold";
import { addDays, localDate, monthKey, weekStart } from "./statsDates";

export type Grain = "day" | "week" | "month";

export interface ChartBucket extends DailyUsage {
  /** The bucket's last day; `date` is its first. */
  end: string;
  /** Holds today, which isn't over yet. */
  partial: boolean;
}

// Past this many days a bar per day gets too thin to read.
const DAILY_LIMIT = 45;

/** Every day of the period up to today, the ones without usage as zeros. */
export function calendarDays(
  daily: DailyUsage[],
  periodDays: number,
  today = localDate(),
): DailyUsage[] {
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const first = periodDays > 0 ? addDays(today, -(periodDays - 1)) : (daily[0]?.date ?? today);
  const days: DailyUsage[] = [];
  for (let date = first < today ? first : today; date <= today; date = addDays(date, 1)) {
    days.push(byDate.get(date) ?? emptyDay(date));
  }
  return days;
}

export function grainChoices(dayCount: number): Grain[] {
  return dayCount >= 28 ? ["day", "week", "month"] : ["day"];
}

export function defaultGrain(dayCount: number): Grain {
  return dayCount > DAILY_LIMIT ? "week" : "day";
}

export function bucketDays(days: DailyUsage[], grain: Grain, today = localDate()): ChartBucket[] {
  if (grain === "day") {
    return days.map((day) => ({ ...day, end: day.date, partial: day.date === today }));
  }
  const keyOf = grain === "week" ? weekStart : monthKey;
  const buckets: ChartBucket[] = [];
  for (const day of days) {
    let bucket = buckets[buckets.length - 1];
    if (!bucket || keyOf(bucket.date) !== keyOf(day.date)) {
      bucket = { ...emptyDay(day.date), end: day.date, partial: false };
      buckets.push(bucket);
    }
    addDay(bucket, day);
    bucket.end = day.date;
    bucket.partial = day.date === today;
  }
  return buckets;
}
