import type { AgentState } from "./agentStatus";
import { displayNameForProjectName } from "./components/ProjectNameDisplay";
import { useNotificationHistory } from "./notifications/history";
import { toast } from "./notifications/toast";
import type { NotificationEvent } from "./notifications/types";
import { projectAgentRows, type SidebarAgentRow } from "./sidebarAgents";
import { sideBySideColumns } from "./sideBySide";
import { useAppStore } from "./store/app";
import { useGlobalAgentStatus } from "./store/globalAgentStatus";
import { useSideBySide } from "./store/sideBySide";
import { useTerminalTitles } from "./store/terminalTitles";
import { GLOBAL_TERMINALS_KEY, GLOBAL_TERMINALS_LABEL } from "./terminals";

type Notable = Extract<AgentState, "needs-you" | "done" | "error">;

const NOTABLE: Record<Notable, { event: NotificationEvent; kind: "warning" | "success" | "error"; verb: string }> = {
  "needs-you": { event: "agentWaiting", kind: "warning", verb: "needs you" },
  done: { event: "agentDone", kind: "success", verb: "finished" },
  error: { event: "agentError", kind: "error", verb: "hit a problem" },
};

const isNotable = (state: AgentState): state is Notable => state in NOTABLE;

export interface ProjectAgents {
  project: string;
  rows: SidebarAgentRow[];
}

export interface AgentArrival {
  project: string;
  row: SidebarAgentRow & { state: Notable };
}

export const agentToastId = (project: string, key: string) => `agent:${project}:${key}`;

/** Agents whose state changed since `seen`, which is updated in place. A state
 *  worth telling about arrives; anything else only retires the agent's toast.
 *  An agent's first sighting is where it starts from, not news: it may have
 *  been waiting since before this window was watching. */
export function agentChanges(
  seen: Map<string, AgentState>,
  projects: ProjectAgents[],
): { arrivals: AgentArrival[]; settled: string[] } {
  const arrivals: AgentArrival[] = [];
  const settled: string[] = [];
  const present = new Set<string>();
  for (const { project, rows } of projects) {
    for (const row of rows) {
      const id = agentToastId(project, row.key);
      present.add(id);
      const before = seen.get(id);
      if (before === row.state) continue;
      seen.set(id, row.state);
      if (before === undefined) continue;
      const { state } = row;
      if (isNotable(state)) arrivals.push({ project, row: { ...row, state } });
      else settled.push(id);
    }
  }
  for (const id of seen.keys()) {
    if (present.has(id)) continue;
    seen.delete(id);
    settled.push(id);
  }
  return { arrivals, settled };
}

/** Whether the agent's tab is the one in front in a project that's on screen. */
function tabOnScreen(project: string, terminalId: string | null): boolean {
  const { view, selected, projects } = useAppStore.getState();
  const focused = useTerminalTitles.getState().focusedByProject[project] ?? null;
  if (terminalId === null || focused !== terminalId) return false;
  if (project === GLOBAL_TERMINALS_KEY) return view === "terminals";
  if (view !== "projects") return false;
  if (selected === project) return true;
  const names = new Set(projects.map((p) => p.name));
  return sideBySideColumns(useSideBySide.getState().names, selected, names).includes(project);
}

function projectLabel(project: string): string {
  if (project === GLOBAL_TERMINALS_KEY) return GLOBAL_TERMINALS_LABEL;
  return displayNameForProjectName(project, useAppStore.getState().projects);
}

/** A toast for an agent that needs you, finished or stopped in a tab you're not
 *  looking at — the in-app counterpart of the system banner. The toast module
 *  keeps it to the history when its event is off in the app. Says whether one
 *  was told. */
function announceAgent({ project, row }: AgentArrival): boolean {
  const { event, kind, verb } = NOTABLE[row.state];
  if (tabOnScreen(project, row.terminalId)) return false;
  const { terminalId } = row;
  toast[kind](`${row.title} ${verb}`, {
    id: agentToastId(project, row.key),
    event,
    description: `${projectLabel(project)} · ${row.provider}`,
    action: terminalId
      ? { label: "Open tab", onClick: () => useAppStore.getState().focusProjectTerminal(project, terminalId) }
      : undefined,
  });
  return true;
}

/** Watches every project's agents, from the stores the sidebar reads, and
 *  toasts their news. Works off the stores directly so nothing re-renders. */
export function watchAgents(): () => void {
  const seen = new Map<string, AgentState>();
  const shown = new Set<string>();
  let inputs: unknown[] = [];

  // A wait that ended needs nobody any more, so the bell stops counting it too.
  const retire = (id: string) => {
    useNotificationHistory.getState().markRead(id);
    if (shown.delete(id)) toast.dismiss(id);
  };

  const check = () => {
    const { projects } = useAppStore.getState();
    const { entries } = useGlobalAgentStatus.getState();
    const titles = useTerminalTitles.getState().byProject;
    if (projects === inputs[0] && entries === inputs[1] && titles === inputs[2]) return;
    inputs = [projects, entries, titles];

    const now = Date.now();
    const { arrivals, settled } = agentChanges(seen, [
      ...projects.map((p) => ({ project: p.name, rows: projectAgentRows(p, now, titles[p.name]) })),
      {
        project: GLOBAL_TERMINALS_KEY,
        rows: projectAgentRows({ statusEntries: entries }, now, titles[GLOBAL_TERMINALS_KEY]),
      },
    ]);
    settled.forEach(retire);
    for (const arrival of arrivals) {
      const id = agentToastId(arrival.project, arrival.row.key);
      if (announceAgent(arrival)) shown.add(id);
      else retire(id);
    }
  };

  check();
  const unsubscribe = [
    useAppStore.subscribe(check),
    useGlobalAgentStatus.subscribe(check),
    useTerminalTitles.subscribe(check),
  ];
  return () => unsubscribe.forEach((stop) => stop());
}
