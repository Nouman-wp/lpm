import type { ReactNode } from "react";
import { Check, Clock, ExternalLink, Minus, X } from "lucide-react";
import { ChevronRightIcon, TrashIcon } from "../../icons";
import { HoverActionButton } from "./HoverActionButton";
import { relativeTime } from "../../../relativeTime";
import {
  formatCost,
  formatDuration,
  jobOutputSnippet,
  jobEntryLabel,
  jobResultTone,
  isThreadUnread,
  jobThreadTail,
  type JobResultTone,
  type JobThread,
} from "../../../jobsFormat";

// The run's outcome where a conversation list shows its avatar.
const TONE_BADGE: Record<JobResultTone, { icon: ReactNode; className: string }> = {
  success: { icon: <Check size={18} strokeWidth={2.2} />, className: "text-[var(--accent-cyan-text)]" },
  error: { icon: <X size={18} strokeWidth={2.2} />, className: "text-[var(--accent-red-text)]" },
  warning: { icon: <Clock size={17} />, className: "text-[var(--accent-amber-text)]" },
  neutral: { icon: <Minus size={18} />, className: "text-[var(--text-muted)]" },
};

// One run of a job as a messenger-style row: outcome and vitals on the first
// line, a couple of clamped lines of the latest message below. Opens the run's
// own page when there is a conversation to show; its buttons take the place
// of the time while hovered.
export function JobRunRow({
  thread,
  onOpen,
  onOpenCopy,
  onRemove,
}: {
  thread: JobThread;
  onOpen?: () => void;
  onOpenCopy: (project: string) => void;
  onRemove?: () => void;
}) {
  const root = thread.root;
  const tail = jobThreadTail(thread);
  const snippet = jobOutputSnippet(tail.output, 320);
  const replies = thread.replies.length;
  const stats = [
    replies > 0 ? `${replies} ${replies === 1 ? "reply" : "replies"}` : "",
    root.durationSecs !== undefined && root.durationSecs > 0
      ? formatDuration(root.durationSecs)
      : "",
    root.costUsd !== undefined ? formatCost(root.costUsd) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const label = `${jobEntryLabel(root)}${
    (root.count ?? 1) > 1 ? ` × ${root.count}` : ""
  }`;
  const unread = isThreadUnread(thread);
  const badge = TONE_BADGE[jobResultTone(root.result)];
  const hasActions = Boolean(root.copy) || Boolean(onRemove);

  const content = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={`min-w-0 truncate text-[14.5px] text-[var(--text-primary)] ${
            unread ? "font-semibold" : "font-medium"
          }`}
        >
          {label}
        </span>
        {stats && (
          <span className="min-w-0 shrink-[4] truncate text-[12px] tabular-nums text-[var(--text-muted)]">
            {stats}
          </span>
        )}
      </span>
      {snippet && (
        <span
          className={`mt-1 line-clamp-2 break-words text-[13.5px] leading-[1.45] [overflow-wrap:anywhere] ${
            unread ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
          }`}
        >
          {snippet}
        </span>
      )}
    </>
  );

  return (
    <div className="group flex items-start gap-3 rounded-[14px] py-3 pl-1 pr-3 transition-colors focus-within:bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]">
      <span className="flex w-2.5 shrink-0 justify-center pt-[15px]">
        {unread && (
          <span aria-hidden className="h-[9px] w-[9px] rounded-full bg-[var(--accent-blue)]" />
        )}
      </span>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--bg-hover)] ${badge.className}`}
      >
        {badge.icon}
      </span>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 pt-0.5 text-left">
          {content}
        </button>
      ) : (
        <span className="min-w-0 flex-1 pt-0.5">{content}</span>
      )}
      <span
        className={`flex shrink-0 items-center gap-1 pt-1 ${
          hasActions ? "group-focus-within:hidden group-hover:hidden" : ""
        }`}
      >
        <span
          title={new Date(tail.at * 1000).toLocaleString()}
          className="text-[12px] tabular-nums text-[var(--text-muted)]"
        >
          {relativeTime(tail.at)}
        </span>
        {onOpen && (
          <span className="scale-90 text-[var(--text-muted)] opacity-70">
            <ChevronRightIcon />
          </span>
        )}
      </span>
      {hasActions && (
        <span className="hidden shrink-0 items-center gap-1 group-focus-within:flex group-hover:flex">
          {root.copy && (
            <HoverActionButton
              label="Open copy"
              title="Open the copy this run worked in"
              onClick={() => onOpenCopy(root.copy as string)}
            >
              <ExternalLink size={14} />
            </HoverActionButton>
          )}
          {onRemove && (
            <HoverActionButton label="Remove this run" title="Remove" danger onClick={onRemove}>
              <TrashIcon size={13} />
            </HoverActionButton>
          )}
        </span>
      )}
    </div>
  );
}
