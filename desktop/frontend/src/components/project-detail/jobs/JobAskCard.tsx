import type { JobAsk } from "../../../jobAsk";
import { JobAskForm } from "./JobAskForm";
import { JobAskSummary } from "./JobAskSummary";

interface JobAskCardProps {
  ask: JobAsk;
  // Where the job is waiting — the project its answer goes to.
  project: string;
  jobId: string;
  onAnswered?: () => void;
}

// A question a run put to the user: the answers stacked like an action sheet
// while it's open, then what became of it.
export function JobAskCard({ ask, project, jobId, onAnswered }: JobAskCardProps) {
  const open = ask.status === "open";
  return (
    <div data-job-ask={ask.id} className={`max-w-2xl rounded-2xl border border-[var(--border)] ${open ? "p-4" : "px-4 py-3"}`}>
      {open ? (
        <JobAskForm ask={ask} project={project} jobId={jobId} onAnswered={onAnswered} />
      ) : (
        <JobAskSummary ask={ask} />
      )}
    </div>
  );
}
