import { forEachAction } from "./actionTree";
import {
  PRIMARY_LAST_USED,
  loadRememberedChild,
  rememberChild,
  resolvePrimaryChild,
} from "./components/splitPrimary";
import { detectAICLI } from "./slashCommands";
import type { ActionInfo, AICLI } from "./types";

// Something the launchpad can start with its prompt: an agent action, or a
// bare agent CLI when the project has none.
export interface LaunchpadOption {
  id: string;
  label: string;
  agent: AICLI;
}

// One tab in the launchpad's row: a single option, or a header split button
// or menu holding several.
export interface LaunchpadTab {
  key: string;
  label: string;
  options: LaunchpadOption[];
  // What the tab's main part picks; null for a menu, which only opens.
  primary: LaunchpadOption | null;
}

export interface AgentAction {
  action: ActionInfo;
  agent: AICLI;
}

// A header action as the launchpad offers it: its own command when that opens
// an agent CLI, and the agent actions inside it when it is a split button or a
// menu.
export interface AgentActionEntry {
  action: ActionInfo;
  own: AgentAction | null;
  children: AgentAction[];
}

function asAgentAction(action: ActionInfo): AgentAction | null {
  const agent = action.type === "terminal" ? detectAICLI(action.cmd) : null;
  return agent ? { action, agent } : null;
}

export function agentActionEntries(actions: ActionInfo[]): AgentActionEntry[] {
  const entries: AgentActionEntry[] = [];
  for (const action of actions) {
    const children: AgentAction[] = [];
    forEachAction(action.children ?? [], (child) => {
      const found = asAgentAction(child);
      if (found) children.push(found);
    });
    const own = asAgentAction(action);
    if (own || children.length > 0) entries.push({ action, own, children });
  }
  return entries;
}

export function entryAgentActions(entry: AgentActionEntry): AgentAction[] {
  return entry.own ? [entry.own, ...entry.children] : entry.children;
}

// The entries as tabs, each split button led by the item the header's button
// would run (its last used one, when it remembers that).
export function launchpadActionTabs(entries: AgentActionEntry[], scope: string): LaunchpadTab[] {
  return entries.map((entry) => {
    const { action } = entry;
    const options = entryAgentActions(entry).map((a) => ({
      id: a.action.name,
      label: a.action.label || a.action.name,
      agent: a.agent,
    }));
    if (entry.children.length === 0) return { key: action.name, label: options[0].label, options, primary: options[0] };
    const lead = resolvePrimaryChild(action, loadRememberedChild(scope, action.name));
    const split = !!action.primary || !!action.cmd;
    const primary = options.find((o) => o.id === lead?.name) ?? (split ? options[0] : null);
    return { key: action.name, label: action.label || action.name, options, primary };
  });
}

// The action a menu item runs as from the header: in its group's color when it
// has none of its own. A "last used" split button remembers it, as a run from
// its own menu would.
export function runAsGroupChild(scope: string, group: ActionInfo, child: ActionInfo): ActionInfo {
  const rest = child.name.slice(group.name.length + 1);
  if (group.primary === PRIMARY_LAST_USED && child.name.startsWith(`${group.name}:`) && !rest.includes(":")) {
    rememberChild(scope, group.name, rest);
  }
  return child.color || !group.color ? child : { ...child, color: group.color };
}

const KEY = "lpm:launchpad:action:v1";

// What the launchpad last started (an action, an agent CLI or "terminal"),
// remembered on this computer.
export function loadLaunchpadAction(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// The saved pick while this project still offers it, else Terminal.
export function launchpadPick(ids: string[], saved: string | null): string {
  return saved && ids.includes(saved) ? saved : "terminal";
}

export function saveLaunchpadAction(name: string): void {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    /* a convenience only */
  }
}
