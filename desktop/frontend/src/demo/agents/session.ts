import type { AgentKind, AgentStep, ReplyIntent, SeedSession } from "../seed/types";
import { CLEAR, clip } from "../ansi";
import type { AgentHost, AgentLaunch, AgentSession } from "./api";
import { launchModel } from "./brand";
import { createEditor } from "./editor";
import { createKeyReader, type Key } from "./keys";
import type { Look, LookContext, TurnLines } from "./look";
import { claudeLook } from "./look-claude";
import { codexLook } from "./look-codex";
import { geminiLook } from "./look-gemini";
import { opencodeLook } from "./look-opencode";
import type { ParsedLaunch } from "./parse";
import { createScreen } from "./screen";
import {
  AFFIRMATIVE,
  GENERIC_REPLY_CONTEXT,
  buildReply,
  closingStart,
  keepAliveSteps,
  settleStep,
  stepDelay,
} from "./script";
import { imagePaste, pasteLabel, slashCommand } from "./prompts";
import { palette } from "./theme";

// What a launch command says beyond AgentLaunch, as parseLaunch reads it:
// the model it pins, shown in the banner and status line, and the session ids.
export type AgentLaunchOptions = AgentLaunch & Pick<ParsedLaunch, "model" | "effort" | "sessionId" | "resumeId">;

// An idle session draws nothing until it is typed into, so a host that resizes
// the terminal calls `resize` to have the prompt redrawn at the new width.
export type RunningAgent = AgentSession & { resize: () => void };

const LOOKS: Record<AgentKind, Look> = {
  claude: claudeLook,
  codex: codexLook,
  gemini: geminiLook,
  opencode: opencodeLook,
};

const FINISH_MS = 220;
// How long a still-working seeded session trickles in more work, then lands.
const KEEP_ALIVE_MS = 5200;
const SETTLE_AFTER_MS = 32_000;
const FRAME_MS = 120;
const EXIT_ARM_MS = 2000;
// What a reopened turn that stopped on a question spent before it asked.
const SEEDED_TURN_MS = 52_000;

interface Turn {
  id: number;
  steps: AgentStep[];
  revealed: number;
  startedAt: number;
  keepBusy: boolean;
  intent?: ReplyIntent;
  // Steps from here on are the closing message Codex rules off.
  closingFrom: number;
  lines: TurnLines;
  frame: number;
}

// Rough enough to read like the live counter Claude Code shows mid-turn: all it
// has to do is grow with the work already on screen.
function tokensFor(turn: Turn): number {
  return turn.steps.slice(0, turn.revealed).reduce((total, step) => {
    if (step.kind === "tool") return total + 340;
    if (step.kind === "text") return total + Math.ceil(step.text.length / 3);
    return total + 120;
  }, 280);
}

function newSessionId(): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `019a${hex(4)}-${hex(4)}-7${hex(3)}-${hex(4)}-${hex(12)}`;
}

export function startAgent(host: AgentHost, launch: AgentLaunchOptions): RunningAgent {
  const look = LOOKS[launch.kind];
  const colors = palette();
  const screen = createScreen(host.write, () => host.cols() || 80);
  const editor = createEditor();
  const readKeys = createKeyReader();
  const knows = launch.reply ?? GENERIC_REPLY_CONTEXT;
  const sessionId = launch.resumeId ?? launch.sessionId ?? newSessionId();
  let { model, effort } = launchModel(launch.kind, launch.model, launch.effort);

  let turn: Turn | null = null;
  let turns = 0;
  let fresh = true;
  let work = 0;
  let images = 0;
  const pastes = new Map<string, string>();
  let queue: string[] = [];
  let pendingIntent: ReplyIntent | undefined;
  let pendingSteps: AgentStep[] | undefined;
  let keepAlive = 0;
  let exiting: "c" | "d" | null = null;
  let commit: string[] = [];
  let stepTimer: ReturnType<typeof setTimeout> | undefined;
  let frameTimer: ReturnType<typeof setInterval> | undefined;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const ctx = (): LookContext => ({
    cols: Math.max(24, host.cols() || 80),
    cwd: launch.cwd,
    project: launch.project,
    model,
    effort,
    sessionId,
    palette: colors,
  });

  function frame(): string[] {
    const c = ctx();
    const lines: string[] = [];
    if (turn) {
      const working = { seed: turn.id, elapsedMs: Date.now() - turn.startedAt, frame: turn.frame, tokens: tokensFor(turn) };
      lines.push(...turn.lines.live(), ...look.working(working, c).map((line) => clip(line, c.cols - 1)));
    }
    for (const text of queue) lines.push(...look.queued(text, c));
    lines.push("", ...look.composer({ text: editor.text, cursor: editor.cursor, fresh, exiting, work }, c));
    return lines;
  }

  function paint() {
    if (closed) return;
    const lines = commit;
    commit = [];
    screen.paint(lines, frame());
  }

  function stopTimers() {
    clearTimeout(stepTimer);
    clearInterval(frameTimer);
  }

  function run(text: string, shown = text) {
    const said = text.trim().toLowerCase();
    let steps: AgentStep[];
    let keepBusy = false;
    let intent: ReplyIntent | undefined;
    if (launch.task && said === launch.task.prompt.trim().toLowerCase()) {
      steps = launch.task.steps;
      keepBusy = !!launch.task.keepBusy;
    } else if (pendingSteps && AFFIRMATIVE.test(said)) {
      steps = pendingSteps;
    } else {
      const reply = buildReply(text, launch.kind, knows, pendingIntent);
      steps = reply.steps;
      intent = reply.intent;
    }
    pendingSteps = undefined;
    pendingIntent = undefined;
    fresh = false;
    const startedAt = Date.now();
    turn = {
      id: ++turns,
      steps: [...steps],
      revealed: 0,
      startedAt,
      keepBusy,
      intent,
      closingFrom: keepBusy ? Infinity : closingStart(steps),
      lines: look.turn(ctx),
      frame: 0,
    };
    commit.push(...look.query(shown, ctx()));
    host.status({ value: "Running", turnStart: startedAt });
    const animated = turn;
    frameTimer = setInterval(() => {
      animated.frame++;
      paint();
    }, FRAME_MS);
    advance();
  }

  function revealNext(t: Turn) {
    const i = t.revealed++;
    const step = t.steps[i];
    if (step.kind === "tool") work++;
    commit.push(...t.lines.reveal(step, { closing: i >= t.closingFrom, ms: Date.now() - t.startedAt }));
  }

  // One pending timer at a time: the next step, the landing, or — for a seeded
  // task that keeps busy — more work trickling in before it settles.
  function advance() {
    const t = turn;
    if (!t) return;
    clearTimeout(stepTimer);
    if (t.revealed < t.steps.length) {
      stepTimer = setTimeout(() => {
        revealNext(t);
        paint();
        advance();
      }, stepDelay(t.steps[t.revealed]));
      return;
    }
    if (!t.keepBusy || queue.length) {
      stepTimer = setTimeout(() => finish(), FINISH_MS);
      return;
    }
    const alive = keepAliveSteps(knows);
    if (keepAlive >= alive.length) {
      stepTimer = setTimeout(() => finish(settleStep(knows)), SETTLE_AFTER_MS);
      return;
    }
    stepTimer = setTimeout(() => {
      t.steps.push(alive[keepAlive++]);
      advance();
    }, KEEP_ALIVE_MS);
  }

  function land(t: Turn, interrupted: boolean): number {
    stopTimers();
    const landedAt = Date.now();
    commit.push(...t.lines.end({ ms: landedAt - t.startedAt, interrupted, seed: t.id }));
    turn = null;
    return landedAt;
  }

  // A turn that ends on a question is waiting on you, not done with you.
  function finish(closing?: AgentStep) {
    const t = turn;
    if (!t) return;
    if (closing) {
      t.closingFrom = t.steps.length;
      t.steps.push(closing);
    }
    while (t.revealed < t.steps.length) revealNext(t);
    const landedAt = land(t, false);
    pendingIntent = t.intent;
    host.status({ value: t.intent ? "Waiting" : "Done", turnStart: t.startedAt, endedAt: landedAt });
    if (queue.length) {
      const next = queue.join("\n");
      queue = [];
      run(next);
    }
    paint();
  }

  // The turn in flight stops where it stands; anything queued behind it goes
  // back into the prompt, as the real CLIs hand it back.
  function interrupt() {
    const t = turn;
    if (!t) return;
    const landedAt = land(t, true);
    host.status({ value: "Done", turnStart: t.startedAt, endedAt: landedAt });
    if (queue.length) {
      editor.set([...queue, editor.text].filter(Boolean).join("\n"));
      queue = [];
    }
  }

  // A reopened conversation: its turn drawn as it was left, finished or
  // stopped on a question that a yes now answers.
  function reopen(seed: SeedSession) {
    const now = Date.now();
    const id = ++turns;
    const lines = look.turn(ctx);
    const ms = seed.state === "done" ? seed.ageMs : Math.min(seed.ageMs, SEEDED_TURN_MS);
    const closingFrom = closingStart(seed.task.steps);
    fresh = false;
    commit.push(...look.query(seed.task.prompt, ctx()));
    seed.task.steps.forEach((step, i) => {
      if (step.kind === "tool") work++;
      commit.push(...lines.reveal(step, { closing: i >= closingFrom, ms }));
    });
    commit.push(...lines.end({ ms, interrupted: false, seed: id }));
    if (seed.state === "done") {
      host.status({ value: "Done", turnStart: now - seed.ageMs, endedAt: now });
      return;
    }
    pendingIntent = seed.answer?.intent;
    pendingSteps = seed.answer?.steps;
    host.status({ value: "Waiting", turnStart: now - seed.ageMs });
  }

  function clearSession() {
    host.write(CLEAR);
    screen.reset();
    commit = [...look.banner(ctx())];
    fresh = true;
    work = 0;
    pendingIntent = undefined;
    pendingSteps = undefined;
    host.status(null);
  }

  function quit(command?: string) {
    if (turn) interrupt();
    if (command) commit.push(...look.query(command, ctx()));
    commit.push(...look.farewell(ctx(), work));
    clearTimeout(exitTimer);
    screen.paint(commit, null);
    closed = true;
    host.write("\x1b[?25h\x1b[?2004l");
    host.status(null);
    host.exit();
  }

  // Enter while a turn runs queues the prompt for when it lands; a seeded task
  // that is only keeping busy lands right away to take it.
  function submit() {
    const text = editor.take();
    const command = text.trim();
    if (!command) return;
    const sent = [...pastes].reduce((full, [label, body]) => full.split(label).join(body), text);
    pastes.clear();
    const slash = slashCommand(launch.kind, command);
    if (slash?.kind === "exit") return quit(command);
    if (turn) {
      queue.push(sent);
      if (turn.revealed >= turn.steps.length) advance();
      return;
    }
    if (slash?.kind === "clear") return clearSession();
    if (!slash) return run(sent, text);
    commit.push(...look.query(command, ctx()), ...look.notice(slash.text, ctx()));
    if (slash.model) model = slash.model;
    if (slash.effort !== undefined) effort = slash.effort ?? undefined;
  }

  // A first Ctrl+C clears the prompt or arms the exit; a second one, while the
  // hint shows, quits. Ctrl+C mid-turn interrupts it.
  function control(key: "c" | "d") {
    if (key === "c" && turn) return interrupt();
    if (key === "c" && editor.text) return editor.set("");
    if (key === "d" && editor.text) return editor.del();
    if (exiting === key) return quit();
    exiting = key;
    clearTimeout(exitTimer);
    exitTimer = setTimeout(() => {
      exiting = null;
      paint();
    }, EXIT_ARM_MS);
  }

  function handle(key: Key) {
    switch (key.name) {
      case "text":
        return editor.insert(key.text);
      case "paste": {
        const image = imagePaste(key.text, images + 1);
        if (image) images++;
        const label = image ? null : pasteLabel(launch.kind, key.text, pastes.size + 1);
        if (label) pastes.set(label, key.text);
        return editor.insert(image ?? label ?? key.text);
      }
      case "enter":
        return submit();
      case "newline":
        return editor.insert("\n");
      case "interrupt":
        return control("c");
      case "eof":
        return control("d");
      case "escape":
        return interrupt();
      case "delete":
        return editor.del();
      default:
        return editor[key.name]();
    }
  }

  host.write("\x1b[?25l\x1b[?2004h");
  commit.push(...look.banner(ctx()));
  if (launch.resume) reopen(launch.resume);
  if (launch.prompt?.trim()) run(launch.prompt);
  else if (!launch.resume) host.status(null);
  paint();

  return {
    input(data) {
      if (closed) return;
      for (const key of readKeys(data)) {
        if (closed) return;
        if (exiting && key.name !== "interrupt" && key.name !== "eof") {
          exiting = null;
          clearTimeout(exitTimer);
        }
        handle(key);
      }
      paint();
    },
    resize: paint,
    dispose() {
      closed = true;
      stopTimers();
      clearTimeout(exitTimer);
    },
  };
}
