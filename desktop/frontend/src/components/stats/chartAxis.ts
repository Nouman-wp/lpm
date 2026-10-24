import { shortUsageDate } from "../../agentUsageFormat";
import type { ChartBucket, Grain } from "./chartBuckets";
import { monthKey, monthName, rangeLabel, weekdayIndex } from "./statsDates";

export interface AxisLabel {
  index: number;
  label: string;
}

function monthYear(date: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function startsMonth(bucket: ChartBucket): string | null {
  if (bucket.date.endsWith("-01")) return bucket.date;
  const nextMonth = `${monthKey(bucket.end)}-01`;
  return monthKey(bucket.end) !== monthKey(bucket.date) ? nextMonth : null;
}

function candidates(buckets: ChartBucket[], grain: Grain): AxisLabel[] {
  if (buckets.length <= 1 || (grain === "day" && buckets.length <= 8)) {
    return buckets.map((bucket, index) => ({ index, label: shortUsageDate(bucket.date) }));
  }
  if (grain === "month") {
    const years = new Set(buckets.map((bucket) => bucket.date.slice(0, 4))).size;
    return buckets.map((bucket, index) => ({
      index,
      label: years > 1 ? monthYear(bucket.date) : monthName(bucket.date),
    }));
  }
  if (grain === "day" && buckets.length <= 62) {
    return buckets.flatMap((bucket, index) =>
      weekdayIndex(bucket.date) === 0 ? [{ index, label: shortUsageDate(bucket.date) }] : [],
    );
  }
  const labels: AxisLabel[] = [{ index: 0, label: shortUsageDate(buckets[0].date) }];
  buckets.forEach((bucket, index) => {
    const month = startsMonth(bucket);
    if (month && index > 0) labels.push({ index, label: monthName(month) });
  });
  return labels;
}

/** Labels for the x axis, thinned so neighbours never crowd each other. */
export function axisLabels(buckets: ChartBucket[], grain: Grain): AxisLabel[] {
  const gap = Math.max(1, Math.ceil(buckets.length * 0.1));
  const kept: AxisLabel[] = [];
  for (const label of candidates(buckets, grain)) {
    const last = kept[kept.length - 1];
    if (!last || label.index - last.index >= gap) kept.push(label);
  }
  return kept;
}

export function bucketLabel(bucket: ChartBucket, grain: Grain): string {
  if (grain === "month") return monthName(bucket.date, true);
  if (grain === "week") return rangeLabel(bucket.date, bucket.end);
  return shortUsageDate(bucket.date);
}

export function peakLabel(bucket: ChartBucket, grain: Grain): string {
  if (grain === "month") return monthName(bucket.date);
  if (grain === "week") return `week of ${shortUsageDate(bucket.date)}`;
  return shortUsageDate(bucket.date);
}

export function peakIndex(buckets: ChartBucket[]): number | null {
  let peak: number | null = null;
  buckets.forEach((bucket, index) => {
    if (
      bucket.totalTokens > 0 &&
      (peak === null || bucket.totalTokens > buckets[peak].totalTokens)
    ) {
      peak = index;
    }
  });
  return peak;
}
