import {
  isBlockedResult,
  jobOutputSnippet,
  jobResultLabel,
  jobResultTone,
  type JobInfo,
} from "../../../jobsFormat";

export type JobPreviewTone = "error" | "warning" | "running" | "unread" | "muted";

export interface JobPreview {
  prefix: string;
  text: string;
  tone: JobPreviewTone;
}

// The second line of a job row: what the job last said, unless something about
// its state matters more right now.
export function jobRowPreview(job: JobInfo, runningText: string): JobPreview {
  if (!job.valid) {
    return {
      prefix: "",
      text: job.error || "This job can't run — open it to fix its settings.",
      tone: "error",
    };
  }
  if (job.running) return { prefix: "", text: runningText, tone: "running" };
  if (isBlockedResult(job.lastResult)) {
    return { prefix: "", text: jobResultLabel(job.lastResult), tone: "warning" };
  }
  const resultTone = jobResultTone(job.lastResult);
  if (resultTone === "error") {
    return {
      prefix: "",
      text: `${jobResultLabel(job.lastResult)}. Open it to see what happened.`,
      tone: "error",
    };
  }
  if (resultTone === "warning") {
    return { prefix: "", text: jobResultLabel(job.lastResult), tone: "warning" };
  }
  const unread = job.unread ?? 0;
  const snippet = jobOutputSnippet(job.lastMessage, 320);
  const description = job.description?.replace(/\s+/g, " ").trim() ?? "";
  return {
    prefix: unread > 1 ? `${unread > 9 ? "9+" : unread} new · ` : "",
    text: snippet || description || jobResultLabel(job.lastResult) || "No runs yet",
    tone: unread > 0 ? "unread" : "muted",
  };
}
