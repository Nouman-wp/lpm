import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DailyUsage, PreviousUsage, UsageBreakdown } from "../../types";
import { useAppStore } from "../../store/app";
import { displayNameForProjectName } from "../ProjectNameDisplay";
import { bucketDays, defaultGrain } from "./chartBuckets";
import { type ProjectSortKey, projectPanelRows, sortProjectRows } from "./projectsPanelRows";
import { ProjectRow } from "./ProjectRow";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const COLLAPSED_COUNT = 8;

interface ProjectsPanelProps {
  /** The days in view (the pinned span, or the whole period). */
  days: DailyUsage[];
  /** Every day of the period, for the sparklines. */
  periodDays: DailyUsage[];
  /** The period's project rows, for an older computer that sends no per-day ones. */
  fallback: UsageBreakdown[];
  previous?: PreviousUsage;
  /** "vs Aug 26 – Sep 24", when there's a period before to compare with. */
  changeLabel?: string;
  emptyLabel: string;
  focused: string | null;
  onFocus: (project: string | null) => void;
}

export function ProjectsPanel({
  days,
  periodDays,
  fallback,
  previous,
  changeLabel,
  emptyLabel,
  focused,
  onFocus,
}: ProjectsPanelProps) {
  const reducedMotion = usePrefersReducedMotion();
  const allProjects = useAppStore((s) => s.projects);
  const selectProject = useAppStore((s) => s.selectProject);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("tokens");
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // The stats key is the project's config name (see agent_usage.rs); resolve it
  // to the label-aware display name, falling back to the raw key when no project
  // matches (a history folder whose project was since removed).
  const nameOf = useCallback(
    (key: string) => displayNameForProjectName(key, allProjects),
    [allProjects],
  );

  const buckets = useMemo(
    () => bucketDays(periodDays, defaultGrain(periodDays.length)),
    [periodDays],
  );
  const rows = useMemo(
    () => projectPanelRows(days, fallback, buckets, previous),
    [days, fallback, buckets, previous],
  );
  const showCost = rows.some((row) => row.cost !== null);
  const showChange = previous !== undefined;
  const sortOptions: { key: ProjectSortKey; label: string }[] = [
    { key: "tokens", label: "Tokens" },
    ...(showCost ? [{ key: "cost" as const, label: "Cost" }] : []),
    ...(showChange ? [{ key: "change" as const, label: "Change" }] : []),
    { key: "name", label: "Name" },
  ];
  const activeSort = sortOptions.some((option) => option.key === sortKey) ? sortKey : "tokens";
  const sorted = sortProjectRows(rows, activeSort, descending, nameOf);
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT);

  const onSort = (key: ProjectSortKey) => {
    if (key === activeSort) {
      setDescending((value) => !value);
    } else {
      setSortKey(key);
      setDescending(key !== "name");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-medium">Projects</h2>
        <div className="flex items-center gap-2 text-[11px]">
          {sortOptions.map((option) => {
            const active = option.key === activeSort;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSort(option.key)}
                className={`flex items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] ${
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {option.label}
                {active && (descending ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[var(--text-muted)]">Nothing {emptyLabel}</div>
      ) : (
        <>
          <div className="divide-y divide-[var(--border)]">
            {shown.map((row) => (
              <ProjectRow
                key={row.key}
                row={row}
                name={nameOf(row.key)}
                focused={row.key === focused}
                canOpen={allProjects.some((project) => project.name === row.key)}
                showSpark={buckets.length > 1}
                showCost={showCost}
                showChange={showChange}
                reducedMotion={reducedMotion}
                onFocus={() => onFocus(row.key === focused ? null : row.key)}
                onOpen={() => selectProject(row.key)}
              />
            ))}
          </div>
          {rows.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="w-full border-t border-[var(--border)] px-4 py-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors duration-[120ms] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent-blue)]"
            >
              {expanded ? "Show less" : `Show all (${rows.length})`}
            </button>
          )}
          <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--text-muted)]">
            Bars: share of all tokens{showChange && changeLabel ? ` · change ${changeLabel}` : ""}
          </div>
        </>
      )}
    </div>
  );
}
