import type { AgentState } from "./agentStatus";
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
  if (job.running !== true) {
    const state = unreadState(job);
    return {
      id: `automation:${project.name}:${job.id}`,
      kind: "automation",
      project,
      title: job.label || job.id,
      tabTitle: null,
      shared: 0,
      holdsError: state === "error",
      state,
      statusKey: null,
      statusValue: null,
      terminalId: null,
      jobId: job.id,
      stateSince: stateSinceOf(job.lastRunAt ? job.lastRunAt * 1000 : undefined, now),
      detail: jobResultLabel(job.lastResult) || null,
      dismissable: false,
      dismissBlocked: null,
    };
  }
  return {
    id: `automation:${project.name}:${job.id}`,
    kind: "automation",
    project,
    title: job.label || job.id,
    tabTitle: null,
    shared: 0,
    holdsError: false,
    state: "working",
    statusKey: null,
    statusValue: null,
    terminalId: null,
    jobId: job.id,
    stateSince: stateSinceOf(
      job.runningSince ? job.runningSince * 1000 : undefined,
      now,
    ),
    detail:
      targetCount > 1
        ? `Running in ${job.runningCount ?? 1} of ${targetCount} projects`
        : null,
    dismissable: false,
    dismissBlocked: null,
  };
}
