import type { ContentZoom } from "../hooks/useContentZoom";
import { PlusIcon } from "./icons";
import { CountBadge } from "./ui/CountBadge";
import { SegmentedControl } from "./ui/SegmentedControl";
import { ZoomControl } from "./ui/ZoomControl";

export type AutomationsViewMode = "list" | "week";

const VIEW_OPTIONS = [
  { value: "list" as const, label: "List", tooltip: "Every automation as a feed, newest activity first" },
  { value: "week" as const, label: "Week", tooltip: "When each automation fires, across the week" },
];

interface AutomationsHeaderProps {
  // Showing one project's jobs rather than every project's.
  scoped: boolean;
  hasJobs: boolean;
  unreadCount: number;
  view: AutomationsViewMode;
  onViewChange: (view: AutomationsViewMode) => void;
  zoom: ContentZoom;
  onMarkAllSeen: () => void;
  onNewJob: () => void;
}

function summary(scoped: boolean, unreadCount: number, view: AutomationsViewMode): string {
  if (unreadCount > 0) {
    return `${unreadCount} ${unreadCount === 1 ? "automation has" : "automations have"} new messages since you last looked.`;
  }
  if (view === "week") {
    return scoped
      ? "When this project's automations fire, across the week."
      : "When every automation fires, across the week.";
  }
  return scoped
    ? "The automations that run in this project."
    : "Every automation across your projects, in one place.";
}

export function AutomationsHeader({
  scoped,
  hasJobs,
  unreadCount,
  view,
  onViewChange,
  zoom,
  onMarkAllSeen,
  onNewJob,
}: AutomationsHeaderProps) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 pt-6">
      <div className="min-w-48 flex-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Automations
          <CountBadge count={unreadCount} label="unread automations" size="md" />
        </h1>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          {summary(scoped, unreadCount, view)}
        </p>
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {hasJobs && (
          <SegmentedControl
            value={view}
            options={VIEW_OPTIONS}
            onChange={onViewChange}
            ariaLabel="Automations view"
          />
        )}
        {hasJobs && (
          <ZoomControl
            percent={zoom.percent}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onReset={zoom.zoomReset}
            canZoomIn={zoom.canZoomIn}
            canZoomOut={zoom.canZoomOut}
          />
        )}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllSeen}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            Mark all read
          </button>
        )}
        <button
          type="button"
          onClick={onNewJob}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[13px] font-medium text-[var(--bg-primary)] shadow-sm transition hover:opacity-90"
        >
          <PlusIcon />
          New automation
        </button>
      </div>
    </div>
  );
}
