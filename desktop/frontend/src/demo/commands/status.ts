import type { StatusEntry } from "../../types";
import type { AgentStatus } from "../agents/api";
import type { CommandMap } from "../backend";
import { emitEvent } from "../ipc";
import type { AgentKind } from "../seed/types";

// One entry per terminal, keyed the way each CLI's hooks key it.
const byProject = new Map<string, Map<string, StatusEntry>>();

export function statusKey(kind: AgentKind, sessionId: string, paneId: string): string {
  return kind === "claude" ? `claude_code_${sessionId}` : `${kind}_${paneId}`;
}

function notify(project: string): void {
  emitEvent("status-changed", project);
}

export function setAgentStatus(project: string, paneId: string, key: string, status: AgentStatus | null): void {
  const panes = byProject.get(project) ?? new Map<string, StatusEntry>();
  byProject.set(project, panes);
  if (!status) panes.delete(paneId);
  else {
    const timestamp = status.value === "Running" ? status.turnStart : (status.endedAt ?? status.turnStart);
    panes.set(paneId, {
      key,
      value: status.value,
      priority: 0,
      paneID: paneId,
      timestamp,
      turnStart: status.turnStart,
      endedAt: status.endedAt,
    });
  }
  notify(project);
}

// A seeded session's row moves to the terminal that reopens it.
export function movePaneStatus(project: string, from: string, to: string): void {
  const panes = byProject.get(project);
  const entry = panes?.get(from);
  if (!panes || !entry) return;
  panes.delete(from);
  panes.set(to, { ...entry, paneID: to });
  notify(project);
}

export function statusEntries(project: string): StatusEntry[] {
  return [...(byProject.get(project)?.values() ?? [])];
}

export function dropProjectStatus(project: string): void {
  byProject.delete(project);
}

function clear({ project, paneId }: Record<string, unknown>): null {
  if (byProject.get(String(project))?.delete(String(paneId))) notify(String(project));
  return null;
}

export const statusCommands: CommandMap = {
  clear_status: clear,
  clear_pane_status: clear,
  move_pane_status: ({ project, oldPaneId, newPaneId }) => {
    movePaneStatus(String(project), String(oldPaneId), String(newPaneId));
    return null;
  },
};
