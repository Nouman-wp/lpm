import { GLOBAL_TERMINALS_KEY, GLOBAL_TERMINALS_LABEL } from "./terminals";
import { peerSlugOf } from "./peer/markers";
import type { TerminalTargetInfo } from "./store/terminalTargets";
import type { RemoteAgentLaunch } from "./remoteAgentTabs";

// The tabs a composed prompt can be handed to, grouped the way the picker lists
// them: this terminal's own project first, then the other projects that are open,
// most recently used first, with the standalone Terminals last.

export interface SendTargetRow {
  projectName: string;
  projectLabel: string;
  terminalId: string;
  label: string;
  emoji: string;
  historyKey: string;
  // A prompt carrying images can only go where those files are: image paths are
  // typed into the receiving agent, and the ones this prompt holds live on the
  // machine it was composed on.
  offHost: boolean;
  // Set on a row that opens a new tab running this agent with the prompt,
  // instead of naming a tab that exists; `detail` names its model.
  launch?: RemoteAgentLaunch;
  detail?: string;
}

export interface SendTargetGroup {
  projectName: string;
  projectLabel: string;
  rows: SendTargetRow[];
  // A project with no tabs this session, offered for a new one.
  closed?: boolean;
}

export interface NewTabTarget {
  launch: RemoteAgentLaunch;
  label: string;
  detail: string;
}

// Projects with no tabs open, listed before a search narrows them.
const CLOSED_SHOWN = 5;

interface BuildOptions {
  byProject: Record<string, TerminalTargetInfo[]>;
  // Resolves a project's folder name to what the user sees in the sidebar.
  labelOf: (projectName: string) => string;
  sourceProject: string;
  sourceTerminalId: string;
  // Most-recently-used projects, newest first; anything missing keeps the order
  // it has in `byProject`.
  mru?: string[];
  query?: string;
  // Ends each project with a row starting this agent in a new tab, and offers
  // `allProjects` that have no tabs yet the same way.
  newTab?: NewTabTarget;
  allProjects?: string[];
}

export function buildSendTargets({
  byProject,
  labelOf,
  sourceProject,
  sourceTerminalId,
  mru = [],
  query = "",
  newTab,
  allProjects = [],
}: BuildOptions): SendTargetGroup[] {
  const sourceHost = peerSlugOf(sourceTerminalId);
  const names = Object.keys(byProject).sort(
    (a, b) => rank(a, sourceProject, mru) - rank(b, sourceProject, mru),
  );
  const needle = query.trim().toLowerCase();
  const groups: SendTargetGroup[] = [];
  for (const projectName of names) {
    const projectLabel =
      projectName === GLOBAL_TERMINALS_KEY ? GLOBAL_TERMINALS_LABEL : labelOf(projectName);
    const projectHit = needle === "" || projectLabel.toLowerCase().includes(needle);
    const rows: SendTargetRow[] = [];
    for (const target of byProject[projectName] ?? []) {
      // A prompt sent to the terminal it was written in is just a send.
      if (target.id === sourceTerminalId) continue;
      if (!projectHit && !target.label.toLowerCase().includes(needle)) continue;
      rows.push({
        projectName,
        projectLabel,
        terminalId: target.id,
        label: target.label,
        emoji: target.emoji,
        historyKey: target.historyKey,
        offHost: peerSlugOf(target.id) !== sourceHost,
      });
    }
    if (newTab && projectHit && projectName !== GLOBAL_TERMINALS_KEY) {
      rows.push(newTabRow(projectName, projectLabel, newTab, sourceHost));
    }
    if (rows.length > 0) groups.push({ projectName, projectLabel, rows });
  }
  if (!newTab) return groups;
  const closed = allProjects
    .filter((name) => !(name in byProject) && name !== GLOBAL_TERMINALS_KEY)
    .sort((a, b) => rank(a, sourceProject, mru) - rank(b, sourceProject, mru))
    .map((projectName) => ({ projectName, projectLabel: labelOf(projectName) }))
    .filter((p) => needle === "" || p.projectLabel.toLowerCase().includes(needle))
    .slice(0, needle === "" ? CLOSED_SHOWN : undefined);
  for (const { projectName, projectLabel } of closed) {
    groups.push({
      projectName,
      projectLabel,
      closed: true,
      rows: [newTabRow(projectName, projectLabel, newTab, sourceHost)],
    });
  }
  return groups;
}

function newTabRow(
  projectName: string,
  projectLabel: string,
  newTab: NewTabTarget,
  sourceHost: string | null,
): SendTargetRow {
  return {
    projectName,
    projectLabel,
    terminalId: `new-tab:${projectName}`,
    label: newTab.label,
    emoji: "",
    historyKey: "",
    offHost: peerSlugOf(projectName) !== sourceHost,
    launch: newTab.launch,
    detail: newTab.detail,
  };
}

// The source project leads, the standalone Terminals trail, and everything else
// sits in between by recency.
function rank(projectName: string, sourceProject: string, mru: string[]): number {
  if (projectName === sourceProject) return -1;
  if (projectName === GLOBAL_TERMINALS_KEY) return Number.MAX_SAFE_INTEGER;
  const idx = mru.indexOf(projectName);
  return idx === -1 ? mru.length : idx;
}

export function countTargets(groups: SendTargetGroup[]): number {
  return groups.reduce((n, g) => n + g.rows.length, 0);
}

// Walks every row as the picker paints them, so arrow keys step across group
// boundaries instead of stopping at one.
export function flattenTargets(groups: SendTargetGroup[]): SendTargetRow[] {
  return groups.flatMap((g) => g.rows);
}
