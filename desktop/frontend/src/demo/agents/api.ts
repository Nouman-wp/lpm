import type { AgentKind, AgentTask, ReplyContext, SeedSession } from "../seed/types";

// What an agent session reports for the sidebar row and tab of its terminal:
// the StatusEntry values the app reads (see agentStatus.ts).
export interface AgentStatus {
  value: "Running" | "Done" | "Waiting";
  // Unix ms the current turn started, and ended for "Done".
  turnStart: number;
  endedAt?: number;
}

// The terminal an agent session draws into.
export interface AgentHost {
  write: (data: string) => void;
  status: (status: AgentStatus | null) => void;
  // Back to the shell prompt, as when the CLI exits.
  exit: () => void;
  cols: () => number;
}

export interface AgentLaunch {
  kind: AgentKind;
  project: string;
  cwd: string;
  // Absent for a folder with nothing seeded: the agent answers generically.
  reply?: ReplyContext;
  // The project's own task for this agent: a prompt that matches it gets its
  // steps instead of a canned reply.
  task?: AgentTask;
  // A prompt passed on the command line (`claude 'fix it'`).
  prompt?: string;
  // An earlier session to reopen (`claude --resume <id>`): its turn is drawn
  // as already finished, or waiting on an answer.
  resume?: SeedSession;
}

export interface AgentSession {
  // Raw terminal input: keystrokes, or what the composer pastes and submits.
  input: (data: string) => void;
  dispose: () => void;
  // Redraws an idle prompt at the terminal's new width.
  resize?: () => void;
}
