import { effortBlurb } from "./agentModelMenu";
import { getSettings } from "./store/settings";
import { AI_CLI_OPTIONS, aiEfforts, isAICLI, type AICLI } from "./types";

// What the + popup opens an agent with: a model and level, "" being the CLI's
// own default.
export interface NewTabPick {
  agent: AICLI;
  model: string;
  effort: string;
}

// Where the popup's cursor starts: what was last opened from it.
export type NewTabDestination = AICLI | "terminal";

// Each agent's own pick and the last destination, remembered on this computer
// the way lpm Link remembers its New Tab pick; the prompt never is.
export interface NewTabMemory {
  last: NewTabDestination;
  picks: Record<AICLI, NewTabPick>;
}

const KEY = "lpm:new-tab:picks:v1";

function modelsOf(agent: AICLI) {
  return AI_CLI_OPTIONS.find((o) => o.value === agent)?.models ?? [];
}

/** The pick as the agents are offered now: an agent no longer offered is the
 *  app's default one, and a model or level no longer offered is that agent's
 *  default. */
export function resolveNewTabPick(p: { agent?: unknown; model?: unknown; effort?: unknown }): NewTabPick {
  const fallback = getSettings().aiCli;
  const agent: AICLI = isAICLI(p.agent) ? p.agent : isAICLI(fallback) ? fallback : "claude";
  const model =
    typeof p.model === "string" && modelsOf(agent).some((m) => m.value === p.model) ? p.model : "";
  const effort =
    typeof p.effort === "string" && aiEfforts(agent, model).some((e) => e.value === p.effort)
      ? p.effort
      : "";
  return { agent, model, effort };
}

interface SavedMemory {
  last?: unknown;
  picks?: Record<string, object | undefined>;
}

function readSaved(): SavedMemory {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" ? (saved as SavedMemory) : {};
  } catch {
    return {};
  }
}

export function loadNewTabMemory(): NewTabMemory {
  const saved = readSaved();
  const picks = Object.fromEntries(
    AI_CLI_OPTIONS.map((o) => [o.value, resolveNewTabPick({ ...saved.picks?.[o.value], agent: o.value })]),
  ) as Record<AICLI, NewTabPick>;
  const last =
    saved.last === "terminal" || isAICLI(saved.last) ? saved.last : resolveNewTabPick({}).agent;
  return { last, picks };
}

export function saveNewTabMemory(memory: NewTabMemory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* a convenience only */
  }
}

export function modelName(agent: AICLI, model: string): string {
  if (!model) return "Default model";
  return modelsOf(agent).find((m) => m.value === model)?.label ?? model;
}

export function levelName(agent: AICLI, model: string, effort: string): string {
  return aiEfforts(agent, model).find((e) => e.value === effort)?.label ?? effort;
}

/** "Opus · High", "Default model"; "" for an agent without models to pick. */
export function newTabModelLabel(pick: NewTabPick): string {
  if (modelsOf(pick.agent).length === 0) return "";
  const model = modelName(pick.agent, pick.model);
  return pick.effort ? `${model} · ${levelName(pick.agent, pick.model, pick.effort)}` : model;
}

/** What a level does, in the agent's own words. */
export function levelBlurb(agent: AICLI, effort: string): string {
  if (!effort) return effortBlurb("claude", "auto");
  return agent === "claude" || agent === "codex" ? effortBlurb(agent, effort) : "";
}
