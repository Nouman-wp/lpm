import { RunJobNow } from "../bridge/commands";
import { toast } from "./notifications/toast";
import type { ToastAction, ToastOptions } from "./notifications/types";

export interface JobResult {
  jobId: string;
  /** What the user named it, else its id. */
  name: string;
  result: string;
  /** The project as a toast names it; empty for app-wide automations. */
  project: string;
  /** The project's own name, for the commands that act on the job. */
  projectKey: string;
  copy?: string;
  detail?: string;
  manual?: boolean;
}

// Opens the job in Automations; only the main window can.
export type OpenAutomation = (id: string, project: string | null) => void;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function runAgain(job: JobResult): void {
  RunJobNow(job.projectKey, job.jobId).catch((err) =>
    toast.error(`Couldn't run "${job.name}" again`, { description: errorText(err) }),
  );
}

/** A finished run as a card: the automation's name, its project, what the run
 *  itself reported, and the ways on from there. */
export function announceJobResult(job: JobResult, openAutomation?: OpenAutomation): void {
  const open: ToastAction | undefined = openAutomation && {
    label: job.result === "asked" ? "Answer" : "Open",
    onClick: () => openAutomation(job.jobId, job.project ? job.projectKey : null),
  };
  const card: ToastOptions = {
    tag: job.project || undefined,
    quote: job.detail || undefined,
    event: "automation",
    action: open,
  };
  const again: ToastAction = { label: "Run again", onClick: () => runAgain(job) };

  switch (job.result) {
    case "quiet":
      if (job.manual) toast(job.name, { ...card, description: "Found nothing to report" });
      return;
    case "asked":
      toast.info(job.name, { ...card, description: "Waiting for your answer", duration: 15000 });
      return;
    case "found-work":
      toast.success(job.name, {
        ...card,
        description: job.copy ? `Found work, running in ${job.copy}` : "Found work",
      });
      return;
    case "completed":
      toast.success(job.name, { ...card, description: "Finished", actions: [again] });
      return;
    case "error":
      toast.error(job.name, { ...card, description: "Hit a problem", retry: () => runAgain(job) });
      return;
    case "timed-out":
      toast.error(job.name, {
        ...card,
        description: "Ran past its time limit and was stopped",
        retry: () => runAgain(job),
      });
      return;
  }
}
