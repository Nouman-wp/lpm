import type { AgentState } from "./agentStatus";
import { askSummary, isOpenAsk } from "./jobAsk";
import type { FleetJob, FleetRow } from "./fleetRows";
import { namelessIdentity, type FleetProjectIdentity } from "./fleetIdentity";
import {
  jobResultLabel,
  jobResultTone,
  MULTI_PROJECT_LABEL,
  STANDALONE_PROJECT_LABEL,
} from "./jobsFormat";

// A paired Mac stamps its statuses with its own clock, which can run ahead of
// ours; an unstamped entry would otherwise start in 1970.
export function stateSinceOf(stamped: number | undefined, now: number): number {
  if (!stamped || stamped < 0) return now;
  return Math.min(stamped, now);
}

/** A job spanning several projects headlines none: naming one of its targets
 *  would headline a project that may not be the one running it. */
function automationIdentity(
  targets: string[],
  targetCount: number,
  identities: Map<string, FleetProjectIdentity>,
): FleetProjectIdentity {
  if (targetCount > 1) return namelessIdentity(MULTI_PROJECT_LABEL);
  const name = targets[0] ?? "";
  if (!name) return namelessIdentity(STANDALONE_PROJECT_LABEL);
  return identities.get(name) ?? { ...namelessIdentity(name), name };
}

/** What a finished run nobody has looked at yet asks of the user. */
function unreadState(job: FleetJob): AgentState {
  switch (jobResultTone(job.lastResult)) {
    case "error":
      return "error";
    case "warning":
      return "needs-you";
    default:
      return "done";
  }
}

export function automationRow(
  job: FleetJob,
  targets: string[],
  identities: Map<string, FleetProjectIdentity>,
  now: number,
): FleetRow {
  const targetCount = Math.max(job.targetCount ?? 0, targets.length);
  const project = automationIdentity(targets, targetCount, identities);
  const base = {
    id: `automation:${project.name}:${job.id}`,
    kind: "automation" as const,
    project,
    title: job.label || job.id,
    tabTitle: null,
    shared: 0,
    statusKey: null,
    statusValue: null,
    terminalId: null,
    jobId: job.id,
    dismissable: false,
    dismissBlocked: null,
  };
  // A question the job put to the user is what it needs next, running or not.
  if (isOpenAsk(job.ask)) {
    return {
      ...base,
      holdsError: false,
      state: "needs-you",
      stateSince: stateSinceOf(job.ask.askedAt * 1000, now),
      detail: askSummary(job.ask),
    };
  }
  if (job.running !== true) {
    const state = unreadState(job);
    return {
      ...base,
      holdsError: state === "error",
      state,
      stateSince: stateSinceOf(job.lastRunAt ? job.lastRunAt * 1000 : undefined, now),
      detail: jobResultLabel(job.lastResult) || null,
    };
  }
  return {
    ...base,
    holdsError: false,
    state: "working",
    stateSince: stateSinceOf(job.runningSince ? job.runningSince * 1000 : undefined, now),
    detail:
      targetCount > 1
        ? `Running in ${job.runningCount ?? 1} of ${targetCount} projects`
        : null,
  };
}
