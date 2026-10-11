import { ChevronRightIcon, ClockIcon, PencilIcon, StopIcon, TrashIcon } from "../../icons";
import { PlayIcon } from "../icons";
import { Switch } from "../../ui/Switch";
import { HoverActionButton } from "./HoverActionButton";
import { jobRowPreview, type JobPreviewTone } from "./jobRowPreview";
import { relativeTime } from "../../../relativeTime";
import { useNow } from "../../../hooks/useNow";
import {
  formatNextRun,
  formatRunningFor,
  formatSchedule,
  type JobInfo,
} from "../../../jobsFormat";

interface JobRowProps {
  job: JobInfo;
  // Which projects the job runs in, shown on the row itself so the list can
  // stay flat instead of grouping by project.
  scopeLabel?: string;
  onRunNow: (id: string) => void;
  onStop: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onOpen: (job: JobInfo) => void;
  onEdit: (job: JobInfo) => void;
  onRemove: (job: JobInfo) => void;
}

const TONE_CLASS: Record<JobPreviewTone, string> = {
  error: "text-[var(--accent-red-text)]",
  warning: "text-[var(--accent-amber-text)]",
  running: "text-[var(--accent-cyan-text)]",
  unread: "text-[var(--text-secondary)]",
  muted: "text-[var(--text-muted)]",
};

// One automation as a conversation in a messenger list: who it is, where and
// when it runs, and the last thing it said. Its buttons take the place of the
// time while the row is hovered; the on/off switch under the time stays put.
export function JobRow({ job, scopeLabel, onRunNow, onStop, onToggleEnabled, onOpen, onEdit, onRemove }: JobRowProps) {
  const now = useNow(job.running === true);
  const unread = job.unread ?? 0;
  const enabled = job.enabled;
  const off = job.valid && !enabled;
  // A repo-declared job lives in the repo's own config file, which stays the
  // user's to edit — no delete from here.
  const removable = job.source !== "repo";

  // A shared job runs in many folders at once, so its "running" line aggregates
  // how many are live rather than a single elapsed clock.
  const runningFor = formatRunningFor(job.runningSince, now);
  const elapsedSuffix = runningFor.startsWith("Running —")
    ? runningFor.slice("Running".length)
    : "";
  const runningText =
    job.targetCount && job.targetCount > 1
      ? `Running in ${job.runningCount ?? 0} of ${job.targetCount}${elapsedSuffix}`
      : runningFor;
  const preview = jobRowPreview(job, runningText);

  const meta = [
    scopeLabel,
    job.source === "repo" ? "in repo" : "",
    job.valid && job.schedule ? formatSchedule(job.schedule) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const nextRun = job.valid && enabled ? formatNextRun(job.nextFireAt) : "";
  const when = !job.valid
    ? ""
    : !enabled
      ? "Off"
      : job.lastRunAt
        ? relativeTime(job.lastRunAt)
        : "";

  return (
    <div className="group flex items-start gap-3 rounded-[14px] py-3 pl-1 pr-3 transition-colors focus-within:bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]">
      <span className="flex w-2.5 shrink-0 justify-center pt-[19px]">
        {unread > 0 && (
          <span aria-hidden className="h-[9px] w-[9px] rounded-full bg-[var(--accent-blue)]" />
        )}
      </span>
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--bg-hover)] text-[23px] text-[var(--text-muted)] transition-[opacity,filter] ${
          off ? "opacity-45 grayscale" : ""
        }`}
      >
        {job.emoji || <ClockIcon size={20} />}
      </span>

      <button
        type="button"
        onClick={() => (job.valid ? onOpen(job) : onEdit(job))}
        className="min-w-0 flex-1 pt-0.5 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={`min-w-0 truncate text-[14.5px] ${
              enabled || !job.valid ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            } ${unread > 0 ? "font-semibold" : "font-medium"}`}
          >
            {job.label || job.id}
          </span>
          {meta && (
            <span
              title={nextRun || undefined}
              className="min-w-0 shrink-[4] truncate text-[12px] text-[var(--text-muted)]"
            >
              {meta}
            </span>
          )}
        </span>
        <span
          className={`mt-1 line-clamp-2 break-words text-[13.5px] leading-[1.45] transition-opacity [overflow-wrap:anywhere] ${TONE_CLASS[preview.tone]} ${
            off ? "opacity-55" : ""
          }`}
        >
          {preview.prefix && (
            <span className="font-medium text-[var(--text-primary)]">{preview.prefix}</span>
          )}
          {preview.text}
        </span>
      </button>

      <span className="-mt-0.5 flex shrink-0 flex-col items-end gap-2.5">
        <span className="flex h-[30px] items-center">
          <span className="flex items-center gap-1 group-focus-within:hidden group-hover:hidden">
            {when && (
              <span
                className={`text-[12px] tabular-nums text-[var(--text-muted)] ${off ? "font-medium" : ""}`}
              >
                {when}
              </span>
            )}
            <span className="scale-90 text-[var(--text-muted)] opacity-70">
              <ChevronRightIcon />
            </span>
          </span>
          <span className="hidden items-center gap-1 group-focus-within:flex group-hover:flex">
            {job.valid &&
              (job.running ? (
                <HoverActionButton label="Stop run" title="Stop" danger onClick={() => onStop(job.id)}>
                  <StopIcon />
                </HoverActionButton>
              ) : (
                enabled && (
                  <HoverActionButton label="Run now" onClick={() => onRunNow(job.id)}>
                    <PlayIcon />
                  </HoverActionButton>
                )
              ))}
            <HoverActionButton label="Edit job" title="Edit" onClick={() => onEdit(job)}>
              <PencilIcon size={13} />
            </HoverActionButton>
            {removable && (
              <HoverActionButton label="Remove job" title="Remove" danger onClick={() => onRemove(job)}>
                <TrashIcon size={13} />
              </HoverActionButton>
            )}
          </span>
        </span>
        {job.valid && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={job.label || job.id}
            title={enabled ? "Turn off" : "Turn on"}
            onClick={() => onToggleEnabled(job.id, !enabled)}
            className="-m-1 flex rounded-full p-1"
          >
            <Switch checked={enabled} />
          </button>
        )}
      </span>
    </div>
  );
}
