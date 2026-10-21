import type { CommandMap } from "../backend";
import { emitEvent } from "../ipc";
import { projects, seedData } from "./state";

interface JobRow {
  id: string;
  project?: string;
  targets?: string[];
  unread?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

// The seeded automations whose projects are all in the sidebar.
function jobs(): JobRow[] {
  return (seedData().jobs as JobRow[]).filter((j) =>
    (j.project ? [j.project] : (j.targets ?? [])).every((name) => projects.has(name)),
  );
}

function changed(): null {
  emitEvent("job-status", null);
  return null;
}

interface DemoAsk {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface DemoEntry {
  at: number;
  asks?: DemoAsk[];
  [key: string]: unknown;
}

// Settle the job's open question, and for an answer, the run carrying on.
function settleAsk(jobId: unknown, askId: unknown, answers: unknown): null {
  const job = jobs().find((j) => j.id === jobId);
  if (job) delete job.ask;
  const history = (seedData().jobHistory?.[String(jobId)] ?? []) as DemoEntry[];
  const asking = history.find((e) => e.asks?.some((a) => a.id === askId));
  const ask = asking?.asks?.find((a) => a.id === askId);
  if (!asking || !ask) return changed();
  const now = Math.floor(Date.now() / 1000);
  Object.assign(ask, answers ? { status: "answered", answers, answeredAt: now } : { status: "dismissed", answeredAt: now });
  if (answers) {
    history.push({
      at: now,
      result: "completed",
      follows: asking.at,
      answerTo: ask.id,
      output: "Got it — carrying on from here.",
      durationSecs: 41,
    });
  }
  return changed();
}

export const jobCommands: CommandMap = {
  list_all_jobs: () => jobs(),
  list_jobs: ({ project }) => jobs().filter((j) => j.project === project || j.targets?.includes(String(project))),
  job_history: ({ jobId }) => seedData().jobHistory?.[String(jobId)] ?? [],
  mark_job_seen: ({ jobId }) => {
    const job = jobs().find((j) => j.id === jobId);
    if (job) job.unread = 0;
    for (const run of (seedData().jobHistory?.[String(jobId)] ?? []) as { unread?: boolean }[]) run.unread = false;
    return changed();
  },
  mark_all_jobs_seen: () => {
    for (const job of jobs()) job.unread = 0;
    return changed();
  },
  answer_job_question: ({ jobId, askId, answers }) => settleAsk(jobId, askId, answers ?? {}),
  dismiss_job_question: ({ jobId, askId }) => settleAsk(jobId, askId, null),
  set_job_enabled: ({ jobId, enabled }) => {
    const job = jobs().find((j) => j.id === jobId);
    if (job) job.enabled = Boolean(enabled);
    return changed();
  },
};
