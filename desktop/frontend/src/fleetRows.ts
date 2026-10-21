import type { ProjectInfo, StatusEntry } from "./types";
import {
  AGENT_STATE_RANK,
  agentStateOf,
  providerMeta,
  statusProvider,
  type AgentState,
} from "./agentStatus";
import { byUrgency, foldByPane, paneHoldsError, type PaneAgents } from "./statusByPane";
import { applyFleetFilter, type FleetFilter } from "./fleetFilter";
import {
  fleetIdentityOf,
  terminalsIdentity,
  type FleetProjectIdentity,
} from "./fleetIdentity";
import { formatDuration, jobTargets, type JobInfo } from "./jobsFormat";
import { isOpenAsk } from "./jobAsk";
import { automationRow, stateSinceOf } from "./fleetAutomations";
import { serviceCrashed } from "./serviceExit";
import { peerSlugOf } from "./peer/markers";

export type FleetRowKind = "agent" | "automation";

export interface FleetRow {
  id: string;
  kind: FleetRowKind;
  project: FleetProjectIdentity;
  title: string;
  /** What the terminal tab is called — the agent's session title once it names
   *  one. Null when the tab has no name of its own beyond the agent. */
  tabTitle: string | null;
  /** How many further agents report on this row's tab, folded into it. Zero for
   *  the ordinary tab, which runs a single agent. */
  shared: number;
  /** Whether this tab holds a problem, its own or one folded behind it — a
   *  question outranks a problem, so `state` alone would lose it. */
  holdsError: boolean;
  state: AgentState;
  statusKey: string | null;
  statusValue: string | null;
  terminalId: string | null;
  jobId: string | null;
  /** Millis: when the row entered the state it is in. */
  stateSince: number;
  detail: string | null;
  dismissable: boolean;
  /** Why it cannot be dismissed, ready to show; null when it can. */
  dismissBlocked: string | null;
}

export type FleetChipKind = "profile" | "service";

/** Something the project row can start or stop: a profile shortcut when one
 *  matches the running set, or an individual service in a custom running set. */
export interface FleetChip {
  kind: FleetChipKind;
  name: string;
  running: boolean;
  /** A started service whose command failed; starting it runs it again. */
  crashed?: true;
}

export interface FleetServiceGroup {
  project: FleetProjectIdentity;
  running: string[];
  declared: string[];
  /** The port each service declares, when it declares one. Live detection wins
   *  over this, but it lets a link render before detection comes back. */
  ports: Record<string, number>;
  chips: FleetChip[];
}

export interface FleetCounts {
  needsYou: number;
  error: number;
  working: number;
  done: number;
}

/** `ListAllJobs()` rows: JobInfo plus the owning project the backend stamps on. */
export type FleetJob = JobInfo & { project?: string };

export interface FleetSnapshot {
  projects: ProjectInfo[];
  /** Every machine's jobs, a paired one's naming its projects marked. */
  jobs: FleetJob[];
  /** Millis. */
  now: number;
  filter: FleetFilter;
  /** Paired-Mac slug to the name the user knows it by. */
  peerAliases: Record<string, string>;
  /** Project -> terminal id -> the name that tab is showing. Only projects
   *  open in this session publish one. */
  terminalTitles: Record<string, Record<string, string>>;
  /** The global Terminals' agents, which no project in `projects` carries. */
  terminalEntries: StatusEntry[];
}

export interface Fleet {
  rows: FleetRow[];
  services: FleetServiceGroup[];
  /** Over every row, before the filter, so narrowing the list never hides an
   *  approval prompt from the header. */
  counts: FleetCounts;
  quietProjectCount: number;
}

function agentRow(
  project: FleetProjectIdentity,
  held: PaneAgents,
  now: number,
  tabTitles: Record<string, string>,
): FleetRow {
  const { entry, folded } = held;
  const title = providerMeta(statusProvider(entry.key)).label;
  const tab = tabTitles[entry.paneID ?? ""];
  return {
    // The row is the terminal, so its identity is the terminal's: which of the
    // agents in it currently speaks changes as they trade urgency, and an id
    // that moved with them would drop the user's selection mid-keystroke and
    // unfreeze the list order (useFleetOrder).
    id: `agent:${project.name}:${entry.paneID || entry.key}`,
    kind: "agent",
    project,
    title,
    shared: folded.length,
    holdsError: paneHoldsError(held),
    // An untitled tab is named after its agent, which the row already says.
    tabTitle: tab && tab !== title ? tab : null,
    state: agentStateOf(entry.value),
    statusKey: entry.key,
    statusValue: entry.value,
    terminalId: entry.paneID || null,
    jobId: null,
    stateSince: stateSinceOf(entry.timestamp, now),
    detail: null,
    dismissable: false,
    dismissBlocked: null,
  };
}

function dismissBlockedReason(row: FleetRow): string | null {
  if (row.kind === "automation") {
    return row.state === "working"
      ? "This automation clears itself when the run finishes."
      : "This clears once you open the automation and read its run.";
  }
  switch (row.state) {
    case "needs-you":
      return "The agent is asking for you — answering it is what clears this.";
    case "working":
      return "The agent is still working — this clears when it finishes.";
    case "idle":
      return "There is nothing to clear on this one.";
  }
  if (!row.terminalId || !row.statusValue) {
    return "This isn't tied to an open terminal, so there is nothing to clear.";
  }
  return null;
}

// Dismissing clears every entry on the terminal holding that value. A terminal
// has one row (see foldByPane), so that reaches nothing the row doesn't speak
// for: an agent folded into it that holds a DIFFERENT value keeps its status,
// and the row simply reads as that one afterwards.
function markDismissable(rows: FleetRow[]): void {
  for (const row of rows) {
    const blocked = dismissBlockedReason(row);
    row.dismissable = blocked === null;
    row.dismissBlocked = blocked;
  }
}

/** Needs-you, then problems, then working, then done, then silent; longest in
 *  that state first; ties broken on the stable id so nothing swaps between
 *  renders. */
export function compareFleetRows(a: FleetRow, b: FleetRow): number {
  const rank = AGENT_STATE_RANK[a.state] - AGENT_STATE_RANK[b.state];
  if (rank !== 0) return rank;
  if (a.stateSince !== b.stateSince) return a.stateSince - b.stateSince;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Collapse services into profile shortcuts only while a profile matches the
 *  running set exactly. A custom mix needs individual service chips so every
 *  running process remains visible and independently controllable. */
function chipsOf(project: ProjectInfo, started: Set<string>, crashed: Set<string>): FleetChip[] {
  const profiles = project.profiles ?? [];
  const activeProfile = profiles.find(
    (profile) => profile.name === project.activeProfile,
  );
  // A lit profile would hide which of its services crashed.
  if ((!activeProfile || crashed.size > 0) && started.size + crashed.size > 0) {
    return (project.allServices ?? []).map((service) => ({
      kind: "service",
      name: service.name,
      running: started.has(service.name),
      ...(crashed.has(service.name) ? { crashed: true as const } : {}),
    }));
  }

  const covered = new Set(profiles.flatMap((p) => p.services ?? []));
  const chips: FleetChip[] = profiles.map((profile) => ({
    kind: "profile",
    name: profile.name,
    running: project.activeProfile === profile.name,
  }));
  for (const service of project.allServices ?? []) {
    if (covered.has(service.name)) continue;
    chips.push({
      kind: "service",
      name: service.name,
      running: started.has(service.name),
    });
  }
  return chips;
}

function serviceGroup(
  project: ProjectInfo,
  identity: FleetProjectIdentity,
): FleetServiceGroup | null {
  if (!project.running) return null;
  const running = (project.services ?? []).filter((s) => !s.exited).map((s) => s.name);
  const started = new Set(running);
  const crashed = new Set((project.services ?? []).filter(serviceCrashed).map((s) => s.name));
  const declared = (project.allServices ?? [])
    .map((s) => s.name)
    .filter((name) => !started.has(name));
  if (running.length === 0 && declared.length === 0) return null;
  const ports: Record<string, number> = {};
  for (const s of project.allServices ?? []) if (s.port > 0) ports[s.name] = s.port;
  return {
    project: identity,
    running,
    declared,
    ports,
    chips: chipsOf(project, started, crashed),
  };
}

export function buildFleet(snapshot: FleetSnapshot): Fleet {
  const { projects, jobs, now, filter, peerAliases, terminalTitles, terminalEntries } = snapshot;

  const byName = new Map(projects.map((p) => [p.name, p]));
  const identities = new Map<string, FleetProjectIdentity>();
  for (const project of projects) {
    const slug = peerSlugOf(project.name);
    const peerAlias = slug ? peerAliases[slug] ?? null : null;
    const parent = project.parentName ? byName.get(project.parentName) : undefined;
    identities.set(project.name, fleetIdentityOf(project, parent, peerAlias));
  }

  const rows: FleetRow[] = [];
  const services: FleetServiceGroup[] = [];
  const busy = new Set<string>();
  const pushAgents = (identity: FleetProjectIdentity, entries: StatusEntry[]) => {
    const tabTitles = terminalTitles[identity.name] ?? {};
    // One row per tab, the same fold the sidebar applies — see foldByPane.
    for (const held of foldByPane([...entries].sort(byUrgency))) {
      rows.push(agentRow(identity, held, now, tabTitles));
      busy.add(identity.name);
    }
  };
  pushAgents(terminalsIdentity(), terminalEntries);
  for (const project of projects) {
    const identity = identities.get(project.name) as FleetProjectIdentity;
    pushAgents(identity, project.statusEntries ?? []);
    const group = serviceGroup(project, identity);
    if (group) {
      services.push(group);
      busy.add(project.name);
    }
  }

  for (const job of jobs) {
    const running = job.running === true;
    // A finished run nobody has opened yet is still waiting on the user, and so
    // is a question the job asked.
    if (!running && (job.unread ?? 0) === 0 && !isOpenAsk(job.ask)) continue;
    const targets = jobTargets(job);
    rows.push(automationRow(job, targets, identities, now));
    // Every project the job runs in is busy, even the ones the row can't name.
    if (running) for (const name of targets) busy.add(name);
  }

  markDismissable(rows);

  const counts: FleetCounts = { needsYou: 0, error: 0, working: 0, done: 0 };
  let quietProjectCount = 0;
  for (const row of rows) {
    if (row.state === "needs-you") counts.needsYou++;
    else if (row.state === "working") counts.working++;
    else if (row.state === "done") counts.done++;
    // Counted off `holdsError`, not off the state: a terminal answering a
    // question can hold a problem behind it, and that problem is still one.
    if (row.holdsError) counts.error++;
  }
  for (const project of projects) {
    if (!busy.has(project.name)) quietProjectCount++;
  }

  const visible = applyFleetFilter(rows.sort(compareFleetRows), services, filter);

  return {
    rows: visible.rows,
    services: visible.services,
    counts,
    quietProjectCount,
  };
}

/** "waiting 4m" / "working 2m" — how long the row has held its state. */
export function fleetElapsedLabel(row: FleetRow, now: number): string {
  const span = formatDuration(Math.max(0, Math.floor((now - row.stateSince) / 1000)));
  switch (row.state) {
    case "needs-you":
      return `waiting ${span}`;
    case "error":
      return `error ${span}`;
    case "working":
      return `working ${span}`;
    case "done":
      return `done ${span}`;
    default:
      return `open ${span}`;
  }
}
