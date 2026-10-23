import { detectAICLI } from "./slashCommands";
import {
  followsAgentTitle,
  isTerminalTab,
  terminalDisplayLabel,
  type TerminalInstance,
} from "./paneTree";
import type { TerminalCommandState } from "./store/terminalCommands";

const MAX_NAME = 24;
const MAX_WORDS = 3;
// A command quicker than this ends without a mark: `ls` or a typo isn't news.
const MARK_AFTER_MS = 2000;
// Ctrl-C: the person stopped it themselves.
const INTERRUPTED = 130;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** "pnpm test", "npm run dev", "docker compose up": the program and the words
 *  saying what it does. Env assignments ahead of it are left out, and so is
 *  everything from the first flag on, where tokens and passwords tend to go. */
export function commandName(line: string): string {
  const words = line.trim().split(/\s+/).filter(Boolean);
  const start = words.findIndex((w) => !ENV_ASSIGNMENT.test(w));
  if (start < 0) return "";
  const program = words[start].split("/").pop() ?? "";
  if (program.length > MAX_NAME) return `${program.slice(0, MAX_NAME - 1)}…`;
  const kept = [program];
  for (const word of words.slice(start + 1)) {
    if (kept.length === MAX_WORDS || word.startsWith("-") || /[|;&<>]/.test(word)) break;
    if (`${kept.join(" ")} ${word}`.length > MAX_NAME) break;
    kept.push(word);
  }
  return kept.join(" ");
}

function isAgentLine(line: string): boolean {
  return detectAICLI(line) !== null;
}

/** A shell still under the name it opened with. An action's tab keeps the
 *  action's name, an agent's tab its conversation, and a renamed tab its name. */
function namesAfterCommand(t: TerminalInstance): boolean {
  return (
    isTerminalTab(t) &&
    !t.actionName &&
    !t.startCmd &&
    !t.resumeCmd &&
    !t.sessionTitle &&
    followsAgentTitle(t)
  );
}

/** Tabs whose commands get a mark: shells and command actions, not agents,
 *  whose state the strip already shows. */
function tracksCommands(t: TerminalInstance): boolean {
  return isTerminalTab(t) && !t.resumeCmd && !detectAICLI(t.startCmd);
}

export function terminalStripLabel(t: TerminalInstance, state?: TerminalCommandState): string {
  const run = state?.running;
  if (run?.named && namesAfterCommand(t) && !isAgentLine(run.command)) {
    const name = commandName(run.command);
    if (name) return name;
  }
  return terminalDisplayLabel(t);
}

export type TabCommandMark = "running" | "passed" | "failed";

export function tabCommandMark(t: TerminalInstance, state?: TerminalCommandState): TabCommandMark | null {
  if (!state || !tracksCommands(t)) return null;
  const run = state.running;
  if (run) return run.named && !isAgentLine(run.command) ? "running" : null;
  const last = state.last;
  if (!last || last.ms < MARK_AFTER_MS || last.code === INTERRUPTED || isAgentLine(last.command)) return null;
  return last.code === 0 ? "passed" : "failed";
}

/** What the tab's hover card says about its command: the one running, or the
 *  last one when it left a mark. */
export function tabCommandDetails(
  t: TerminalInstance,
  state?: TerminalCommandState,
): TerminalCommandState | undefined {
  const mark = tabCommandMark(t, state);
  if (!mark) return undefined;
  return mark === "running" ? { running: state!.running } : { last: state!.last };
}
