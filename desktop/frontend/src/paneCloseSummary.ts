import { terminalDisplayLabel, type TerminalInstance } from "./paneTree";
import { count } from "./count";

export function runningAgentCount(tabs: TerminalInstance[], running: ReadonlySet<string> | undefined): number {
  return running ? tabs.filter((t) => running.has(t.id)).length : 0;
}

// The pane's X says what closing it takes along, unless that's one plain tab.
export function closePaneTooltip(tabs: TerminalInstance[], running: number): string {
  const plain = tabs.length === 0 || (tabs.length === 1 && running === 0 && !tabs[0].pinned);
  if (plain) return "Close pane";
  const agents = running > 0 ? ` (${count(running, "agent", "agents")} running)` : "";
  return `Close pane and ${count(tabs.length, "tab", "tabs")}${agents}`;
}

// The undo toast for a closed pane. A pane of one tab reads like that tab's own
// close.
export function paneClosedMessage(
  tabs: TerminalInstance[],
  running: number,
): { title: string; detail?: string } {
  if (tabs.length === 1) {
    return {
      title: `${terminalDisplayLabel(tabs[0])} closed`,
      detail: running > 0 ? "agent running" : undefined,
    };
  }
  if (tabs.length === 0) return { title: "Pane closed" };
  const agents = running > 0 ? `, ${count(running, "agent", "agents")} running` : "";
  return { title: "Pane closed", detail: `${count(tabs.length, "tab", "tabs")}${agents}` };
}
