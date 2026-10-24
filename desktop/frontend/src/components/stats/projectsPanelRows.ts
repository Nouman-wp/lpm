import type { DailyUsage, PreviousUsage, UsageBreakdown } from "../../types";
import { estimateDailyCost } from "./statsCost";
import type { ChartBucket } from "./chartBuckets";
import { foldDays, modelsTotal } from "./usageFold";

export interface ProjectPanelRow {
  key: string;
  tokens: number;
  sessions: number;
  /** Of every project's tokens together. */
  share: number;
  cost: number | null;
  /** Against the period before: a fraction, "new" when it had none, null when unknown. */
  change: number | "new" | null;
  spark: number[];
}

export type ProjectSortKey = "tokens" | "cost" | "change" | "name";

const SPARK_POINTS = 30;

function sparkFor(project: string, buckets: ChartBucket[]): number[] {
  return buckets
    .slice(-SPARK_POINTS)
    .map((bucket) =>
      (bucket.projects ?? [])
        .filter((row) => row.project === project)
        .reduce((sum, row) => sum + modelsTotal(row.models).totalTokens, 0),
    );
}

function changeFor(
  key: string,
  tokens: number,
  previous?: PreviousUsage,
): ProjectPanelRow["change"] {
  if (!previous) return null;
  const before = previous.projects.find((row) => row.key === key)?.tokens.totalTokens ?? 0;
  return before > 0 ? tokens / before - 1 : "new";
}

/** `days` are the scoped range's; projects come from their per-project rows, or
 *  from `fallback` when an older computer sent none (then without cost). */
export function projectPanelRows(
  days: DailyUsage[],
  fallback: UsageBreakdown[],
  buckets: ChartBucket[],
  previous?: PreviousUsage,
): ProjectPanelRow[] {
  const folded = foldDays(days);
  const rows = new Map<string, { tokens: number; sessions: number; cost: number | null }>();
  for (const row of folded.projects ?? []) {
    const entry = rows.get(row.project) ?? { tokens: 0, sessions: 0, cost: 0 };
    entry.tokens += modelsTotal(row.models).totalTokens;
    entry.sessions += row.sessions;
    entry.cost = (entry.cost ?? 0) + estimateDailyCost(row.models);
    rows.set(row.project, entry);
  }
  if (rows.size === 0) {
    for (const project of fallback) {
      rows.set(project.key, {
        tokens: project.tokens.totalTokens,
        sessions: project.sessions,
        cost: null,
      });
    }
  }
  const total = [...rows.values()].reduce((sum, row) => sum + row.tokens, 0);
  return [...rows.entries()]
    .filter(([, row]) => row.tokens > 0)
    .map(([key, row]) => ({
      key,
      ...row,
      share: row.tokens / Math.max(1, total),
      change: changeFor(key, row.tokens, previous),
      spark: sparkFor(key, buckets),
    }));
}

function changeValue(change: ProjectPanelRow["change"]): number {
  if (change === "new") return Number.POSITIVE_INFINITY;
  return change ?? Number.NEGATIVE_INFINITY;
}

export function sortProjectRows(
  rows: ProjectPanelRow[],
  key: ProjectSortKey,
  descending: boolean,
  nameOf: (key: string) => string,
): ProjectPanelRow[] {
  const measure = (row: ProjectPanelRow): number =>
    key === "cost" ? (row.cost ?? -1) : key === "change" ? changeValue(row.change) : row.tokens;
  return [...rows].sort((a, b) => {
    const primary =
      key === "name" ? nameOf(a.key).localeCompare(nameOf(b.key)) : measure(a) - measure(b);
    if (primary !== 0 && !Number.isNaN(primary)) return descending ? -primary : primary;
    return nameOf(a.key).localeCompare(nameOf(b.key));
  });
}
