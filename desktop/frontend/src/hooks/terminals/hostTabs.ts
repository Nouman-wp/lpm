import { type HostTerminal } from "../../peer/hostTerminals";
import {
  type PaneNode,
  clampIdx,
  collectPanes,
  findPane,
  firstPaneId,
  makePaneLeaf,
  makeTerminal,
  mapPane,
  removePane,
} from "../../paneTree";
import { disambiguateLabel, pickTerminalLabel } from "../../terminalLabels";
import { nextId } from "./util";

// Appends the host's terminals behind the tab in view, so one opening on the
// host never pulls focus from what's being typed into here. Into an empty
// project they open as its first pane.
export function withHostTabs(
  tree: PaneNode | null,
  focusedPaneId: string | null,
  terminals: HostTerminal[],
): { tree: PaneNode; focus?: string } {
  const paneId = !tree
    ? nextId("pane")
    : focusedPaneId && findPane(tree, focusedPaneId)
      ? focusedPaneId
      : firstPaneId(tree);
  let next: PaneNode = tree ?? makePaneLeaf(paneId, []);
  for (const t of terminals) {
    const label = t.label ? disambiguateLabel(next, t.label) : pickTerminalLabel(next);
    const tab = makeTerminal(t.id, label, { pinned: t.pinned, emoji: t.emoji, fromHost: true });
    next = mapPane(next, paneId, (p) => ({ ...p, tabs: [...p.tabs, tab] }));
  }
  return tree ? { tree: next } : { tree: next, focus: paneId };
}

// Drops the tabs the host closed. A pane left with nothing collapses, as a close
// here would collapse it, and focus moves on only when its pane went.
export function withoutHostTabs(
  tree: PaneNode,
  focusedPaneId: string | null,
  ids: ReadonlySet<string>,
): { tree: PaneNode | null; focus?: string | null } {
  let next: PaneNode | null = tree;
  for (const pane of collectPanes(tree)) {
    if (!next || !pane.tabs.some((t) => ids.has(t.id))) continue;
    const tabs = pane.tabs.filter((t) => !ids.has(t.id));
    if (tabs.length === 0 && !pane.activeServiceName) {
      next = removePane(next, pane.id);
      continue;
    }
    const kept = tabs.indexOf(pane.tabs[pane.activeTabIdx]);
    const activeTabIdx = kept >= 0 ? kept : clampIdx(pane.activeTabIdx, tabs.length);
    next = mapPane(next, pane.id, (p) => ({ ...p, tabs, activeTabIdx }));
  }
  if (!focusedPaneId || (next && findPane(next, focusedPaneId))) return { tree: next };
  return { tree: next, focus: next ? firstPaneId(next) : null };
}
