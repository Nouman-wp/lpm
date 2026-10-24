import type { AgentUsageStats, DailyUsage, UsageBreakdown } from "../../types";
import { providerMeta } from "./statsDerive";
import { addTokens, emptyTokens, foldDays, modelsTotal, onlyProject } from "./usageFold";
import { addDays, dayStartMs } from "./statsDates";

export interface DayRange {
  from: string;
  to: string;
}

/** What the Stats page is narrowed to: a span of days, a project, both or neither. */
export interface StatsScope {
  range: DayRange | null;
  project: string | null;
}

export const NO_SCOPE: StatsScope = { range: null, project: null };

export function inRange(date: string, range: DayRange): boolean {
  return date >= range.from && date <= range.to;
}

/** A click pins a span, clicking it again unpins it; with Shift it stretches the pin. */
export function nextRange(
  current: DayRange | null,
  picked: DayRange,
  extend: boolean,
): DayRange | null {
  if (extend && current) {
    return {
      from: picked.from < current.from ? picked.from : current.from,
      to: picked.to > current.to ? picked.to : current.to,
    };
  }
  return current?.from === picked.from && current.to === picked.to ? null : picked;
}

export function projectDaily(daily: DailyUsage[], project: string | null): DailyUsage[] {
  return project ? daily.map((day) => onlyProject(day, project)) : daily;
}

function byTokens(a: UsageBreakdown, b: UsageBreakdown): number {
  return b.tokens.totalTokens - a.tokens.totalTokens || a.label.localeCompare(b.label);
}

function rowFor(rows: Map<string, UsageBreakdown>, key: string, label: string): UsageBreakdown {
  let row = rows.get(key);
  if (!row) {
    row = { key, label, sessions: 0, tokens: emptyTokens() };
    rows.set(key, row);
  }
  return row;
}

function finish(rows: Map<string, UsageBreakdown>): UsageBreakdown[] {
  return [...rows.values()].filter((row) => row.tokens.totalTokens > 0).sort(byTokens);
}

function providerRows(folded: DailyUsage): UsageBreakdown[] {
  const rows = new Map<string, UsageBreakdown>();
  for (const model of folded.models) {
    addTokens(
      rowFor(rows, model.provider, providerMeta(model.provider).label).tokens,
      model.tokens,
    );
  }
  for (const row of folded.projects ?? []) {
    rowFor(rows, row.provider, providerMeta(row.provider).label).sessions += row.sessions;
  }
  return finish(rows);
}

function projectRows(folded: DailyUsage): UsageBreakdown[] {
  const rows = new Map<string, UsageBreakdown>();
  for (const row of folded.projects ?? []) {
    const project = rowFor(rows, row.project, row.project);
    project.sessions += row.sessions;
    addTokens(project.tokens, modelsTotal(row.models));
  }
  return finish(rows);
}

export function scopeStats(stats: AgentUsageStats, scope: StatsScope): AgentUsageStats {
  const { range, project } = scope;
  if (!range && !project) return stats;
  const days = range ? stats.daily.filter((day) => inRange(day.date, range)) : stats.daily;
  const picked = projectDaily(days, project);
  const folded = foldDays(picked);
  const from = range ? dayStartMs(range.from) : -Infinity;
  const until = range ? dayStartMs(addDays(range.to, 1)) : Infinity;
  const recentSessions = stats.recentSessions.filter(
    (session) =>
      (!project || session.project === project) &&
      session.lastAt >= from &&
      session.startedAt < until,
  );
  // An older computer sends no per-project days: count its listed sessions instead.
  const complete = picked.every((day) => day.totalTokens === 0 || (day.projects?.length ?? 0) > 0);
  const sessions = complete
    ? (folded.projects ?? []).reduce((sum, row) => sum + row.sessions, 0)
    : recentSessions.length;
  const models: UsageBreakdown[] = folded.models
    .map((model) => ({
      key: model.model,
      label: model.model,
      sessions: 0,
      tokens: model.tokens,
      provider: model.provider,
      fast: model.fast,
      longContext: model.longContext,
    }))
    .sort(byTokens);
  return {
    ...stats,
    sessions,
    totals: modelsTotal(folded.models),
    providers: providerRows(folded),
    projects: projectRows(folded),
    models,
    daily: picked,
    recentSessions,
    previous: range ? undefined : stats.previous,
  };
}
