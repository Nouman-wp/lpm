import { useCallback, useMemo, useState } from "react";
import type { AgentUsageStats } from "../../types";
import { shortUsageDate } from "../../agentUsageFormat";
import { calendarDays } from "./chartBuckets";
import { addDays, daysBetween, localDate, rangeLabel } from "./statsDates";
import {
  type DayRange,
  NO_SCOPE,
  type StatsScope,
  inRange,
  nextRange,
  projectDaily,
  scopeStats,
} from "./statsScope";

function periodWhere(days: number): string {
  if (days === 1) return "today";
  if (days === 0) return "yet";
  return `in the last ${days} days`;
}

/** The Stats page narrowed to a pinned span of days and/or a focused project. */
export function useStatsScope(stats: AgentUsageStats | null, days: number) {
  const [scope, setScope] = useState<StatsScope>(NO_SCOPE);
  const { range, project } = scope;
  const today = localDate();

  const periodDays = useMemo(
    () => (stats ? calendarDays(stats.daily, days, today) : []),
    [stats, days, today],
  );
  const chartDaily = useMemo(() => projectDaily(periodDays, project), [periodDays, project]);
  const tileDays = useMemo(
    () => (range ? chartDaily.filter((day) => inRange(day.date, range)) : chartDaily),
    [chartDaily, range],
  );
  const rangeDays = useMemo(
    () =>
      stats && range ? stats.daily.filter((day) => inRange(day.date, range)) : (stats?.daily ?? []),
    [stats, range],
  );
  const scoped = useMemo(() => (stats ? scopeStats(stats, scope) : null), [stats, scope]);

  const pin = useCallback(
    (picked: DayRange, extend: boolean) =>
      setScope((current) => ({ ...current, range: nextRange(current.range, picked, extend) })),
    [],
  );
  const focusProject = useCallback(
    (name: string | null) => setScope((current) => ({ ...current, project: name })),
    [],
  );
  const clearRange = useCallback(() => setScope((current) => ({ ...current, range: null })), []);
  const reset = useCallback(() => setScope(NO_SCOPE), []);
  // Esc steps back out: the pinned days first, then the project.
  const stepBack = useCallback(() => {
    if (!range && !project) return false;
    setScope((current) => (current.range ? { ...current, range: null } : NO_SCOPE));
    return true;
  }, [range, project]);

  const singleDay = range && range.from === range.to ? range.from : null;
  const previousFrom = addDays(today, -(2 * days - 1));
  return {
    scope,
    scoped,
    periodDays,
    chartDaily,
    tileDays,
    rangeDays,
    pin,
    focusProject,
    clearRange,
    reset,
    stepBack,
    rangeText: range ? rangeLabel(range.from, range.to) : null,
    tileDayCount: range ? daysBetween(range.from, range.to) + 1 : days,
    singleDayCaption:
      singleDay && singleDay !== today ? `on ${shortUsageDate(singleDay)}` : undefined,
    emptyLabel: range
      ? `${singleDay ? "on" : "in"} ${rangeLabel(range.from, range.to)}`
      : periodWhere(days),
    changeLabel:
      stats?.previous && !range && days > 0
        ? `vs ${rangeLabel(previousFrom, addDays(today, -days))}`
        : undefined,
  };
}
