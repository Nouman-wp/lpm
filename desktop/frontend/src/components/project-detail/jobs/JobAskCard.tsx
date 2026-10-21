import { useNow } from "../../../hooks/useNow";
import { relativeAgo } from "../../../relativeTime";
import { askDeadline, askStatusLabel, type JobAsk } from "../../../jobAsk";
import { TONE_DOT_CLASS } from "../../../jobsFormat";
import { JobAskForm } from "./JobAskForm";
import { JobAskSummary } from "./JobAskSummary";

interface JobAskCardProps {
  ask: JobAsk;
  // Where the job is waiting — the project its answer goes to.
  project: string;
  jobId: string;
  onAnswered?: () => void;
}

// A question a run put to the user: the form to answer it while it's open,
// then what became of it.
export function JobAskCard({ ask, project, jobId, onAnswered }: JobAskCardProps) {
  const open = ask.status === "open";
  const now = useNow(open && ask.expiresAt !== undefined, 60_000);
  const when = open
    ? askDeadline(ask, now) || relativeAgo(ask.askedAt)
    : relativeAgo(ask.answeredAt ?? ask.askedAt);

  return (
    <div
      data-job-ask={ask.id}
      className={`rounded-2xl border px-4 py-3 ${
        open
          ? "border-[color-mix(in_srgb,var(--accent-amber)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent-amber)_5%,var(--bg-primary))]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT_CLASS[open ? "warning" : "neutral"]}`}
        />
        <span
          className={`min-w-0 flex-1 truncate text-[11.5px] font-medium ${
            open ? "text-[var(--accent-amber-text)]" : "text-[var(--text-muted)]"
          }`}
        >
          {askStatusLabel(ask)}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">{when}</span>
      </div>
      {open ? (
        <JobAskForm ask={ask} project={project} jobId={jobId} onAnswered={onAnswered} />
      ) : (
        <JobAskSummary ask={ask} />
      )}
    </div>
  );
}
