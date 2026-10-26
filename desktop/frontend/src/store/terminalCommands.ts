import { create } from "zustand";
import { EventsOn } from "../../bridge/runtime";

// What a terminal's shell said about the commands typed into it (cmdmarks.rs):
// the one running now, and how the last one ended.
export interface RunningCommand {
  command: string;
  since: number;
  // Set once it has run long enough to name the tab, so a quick `ls` doesn't
  // flash its name across the strip.
  named: boolean;
}

export interface FinishedCommand {
  command: string;
  code: number;
  ms: number;
  at: number;
}

export interface TerminalCommandState {
  running?: RunningCommand;
  last?: FinishedCommand;
}

export interface TerminalCommandEvent {
  id: string;
  command?: string;
  code?: number;
  at: number;
}

export const NAME_AFTER_MS = 700;

export const useTerminalCommands = create<{
  byId: Record<string, TerminalCommandState>;
  // Whether a terminal's shell last reported its own prompt, so typed input
  // reaches the shell rather than a program it runs. Absent for a shell that
  // doesn't report its commands.
  atPrompt: Record<string, boolean>;
}>(() => ({
  byId: {},
  atPrompt: {},
}));

/** The entries for these terminals, for a shallow-compared selector. */
export function pickCommands(
  byId: Record<string, TerminalCommandState>,
  ids: string[],
): Record<string, TerminalCommandState> {
  const out: Record<string, TerminalCommandState> = {};
  for (const id of ids) if (byId[id]) out[id] = byId[id];
  return out;
}

function put(id: string, next: TerminalCommandState) {
  useTerminalCommands.setState((s) => ({ byId: { ...s.byId, [id]: next } }));
}

function putAtPrompt(id: string, atPrompt: boolean) {
  if (useTerminalCommands.getState().atPrompt[id] === atPrompt) return;
  useTerminalCommands.setState((s) => ({ atPrompt: { ...s.atPrompt, [id]: atPrompt } }));
}

export function applyTerminalCommandEvent(e: TerminalCommandEvent) {
  const current = useTerminalCommands.getState().byId[e.id] ?? {};
  putAtPrompt(e.id, e.command === undefined);
  if (e.command !== undefined) {
    put(e.id, { ...current, running: { command: e.command, since: e.at, named: false } });
    setTimeout(() => {
      const now = useTerminalCommands.getState().byId[e.id];
      if (now?.running?.since === e.at) put(e.id, { ...now, running: { ...now.running, named: true } });
    }, NAME_AFTER_MS);
    return;
  }
  // The prompt before any command, or after one typed before lpm was listening.
  if (e.code === undefined || !current.running) return;
  const { command, since } = current.running;
  put(e.id, { last: { command, code: e.code, ms: Math.max(0, e.at - since), at: e.at } });
}

let listening = false;

export function listenForTerminalCommands() {
  if (listening) return;
  listening = true;
  EventsOn("terminal-command", applyTerminalCommandEvent);
}
