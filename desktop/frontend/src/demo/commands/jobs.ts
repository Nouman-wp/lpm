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
  set_job_enabled: ({ jobId, enabled }) => {
    const job = jobs().find((j) => j.id === jobId);
    if (job) job.enabled = Boolean(enabled);
    return changed();
  },
};
