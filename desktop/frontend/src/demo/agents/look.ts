import type { AgentStep } from "../seed/types";
import { INVERSE, NO_INVERSE, RESET, fg, truncate } from "../ansi";
import { editRows } from "./editor";
import type { Palette } from "./theme";

export interface LookContext {
  cols: number;
  cwd: string;
  project: string;
  model: string;
  effort?: string;
  sessionId: string;
  palette: Palette;
}

export interface Working {
  seed: number;
  elapsedMs: number;
  // Animation ticks since the turn started.
  frame: number;
  tokens: number;
}

export interface Composer {
  text: string;
  cursor: number;
  // Nothing asked yet: the prompt shows its placeholder.
  fresh: boolean;
  // A first Ctrl+C or Ctrl+D on an empty prompt, waiting for the second.
  exiting: "c" | "d" | null;
  // Tool calls so far, which the status lines' context and cost readouts track.
  work: number;
}

export interface TurnEnd {
  ms: number;
  interrupted: boolean;
  seed: number;
}

// One turn's transcript: what each revealed step prints for good, what is
// still changing under it, and how the turn closes.
export interface TurnLines {
  reveal: (step: AgentStep, at: { closing: boolean; ms: number }) => string[];
  live: () => string[];
  end: (end: TurnEnd) => string[];
}

// How one CLI draws itself.
export interface Look {
  banner: (c: LookContext) => string[];
  query: (text: string, c: LookContext) => string[];
  turn: (c: () => LookContext) => TurnLines;
  working: (w: Working, c: LookContext) => string[];
  queued: (text: string, c: LookContext) => string[];
  composer: (v: Composer, c: LookContext) => string[];
  // The answer to a slash command, under its prompt.
  notice: (text: string, c: LookContext) => string[];
  farewell: (c: LookContext, work: number) => string[];
}

// The prompt text in rows of `avail` cells after `first` (its first row) and
// `rest` (the others, as wide), with the cursor drawn in as an inverted cell.
// An empty prompt shows `placeholder` dimmed under the cursor.
export function promptRows(v: Composer, first: string, rest: string, avail: number, placeholder: string, p: Palette): string[] {
  if (!v.text) {
    const [head = " ", ...tail] = truncate(placeholder, avail);
    return [`${first}${fg(p.muted)}${INVERSE}${head}${NO_INVERSE}${tail.join("")}${RESET}`];
  }
  const { rows, row, at } = editRows(v.text, v.cursor, avail);
  return rows.map((text, i) => {
    let shown = text;
    if (i === row) {
      const ch = at < text.length ? String.fromCodePoint(text.codePointAt(at)!) : " ";
      shown = `${text.slice(0, at)}${INVERSE}${ch}${NO_INVERSE}${text.slice(at + ch.length)}`;
    }
    return (i === 0 ? first : rest) + shown;
  });
}

export const dot = (p: Palette) => `${fg(p.muted)} · ${RESET}`;
