import { effortBlurb } from "./agentModelMenu";
import { AI_CLI_OPTIONS, aiEfforts, type AICLI } from "./types";

// What the launchpad opens a bare agent CLI with: a model and level, "" being
// the CLI's own default.
export interface NewTabPick {
  agent: AICLI;
  model: string;
  effort: string;
}

// Each agent's own pick, remembered on this computer the way lpm Link
// remembers its New Tab pick; the prompt never is.
export type NewTabMemory = Record<AICLI, NewTabPick>;

const KEY = "lpm:new-tab:picks:v1";

export function modelsOf(agent: AICLI) {
  return AI_CLI_OPTIONS.find((o) => o.value === agent)?.models ?? [];
}

/** An agent's pick as it is offered now: a model or level no longer offered
 *  is that agent's default. */
export function resolveNewTabPick(agent: AICLI, p: { model?: unknown; effort?: unknown }): NewTabPick {
  const model =
    typeof p.model === "string" && modelsOf(agent).some((m) => m.value === p.model) ? p.model : "";
  const effort =
    typeof p.effort === "string" && aiEfforts(agent, model).some((e) => e.value === p.effort)
      ? p.effort
      : "";
  return { agent, model, effort };
}

interface SavedMemory {
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
  return Object.fromEntries(
    AI_CLI_OPTIONS.map((o) => [o.value, resolveNewTabPick(o.value, { ...saved.picks?.[o.value] })]),
  ) as NewTabMemory;
}

export function saveNewTabMemory(memory: NewTabMemory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ picks: memory }));
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
