import { effortBlurb } from "./agentModelMenu";
import { getSettings } from "./store/settings";
import { AI_CLI_OPTIONS, aiEfforts, isAICLI, type AICLI } from "./types";

// What the + popup opens: an agent on a model and level, "" being the CLI's own
// default. Remembered on this computer the way lpm Link remembers its New Tab
// pick; the prompt never is.
export interface NewTabPick {
  agent: AICLI;
  model: string;
  effort: string;
}

const KEY = "lpm:new-tab:last-pick:v1";

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

export function loadNewTabPick(): NewTabPick {
  try {
    return resolveNewTabPick(JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {});
  } catch {
    return resolveNewTabPick({});
  }
}

export function saveNewTabPick(pick: NewTabPick): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pick));
  } catch {
    /* a convenience only */
  }
}

export function agentName(agent: AICLI): string {
  return AI_CLI_OPTIONS.find((o) => o.value === agent)?.label ?? agent;
}

export function modelName(agent: AICLI, model: string): string {
  if (!model) return "Default model";
  return modelsOf(agent).find((m) => m.value === model)?.label ?? model;
}

export function levelName(agent: AICLI, model: string, effort: string): string {
  return aiEfforts(agent, model).find((e) => e.value === effort)?.label ?? effort;
}

/** "Claude Code · Opus · High"; an agent without models is just its name. */
export function newTabPickLabel(pick: NewTabPick): string {
  if (modelsOf(pick.agent).length === 0) return agentName(pick.agent);
  const parts = [agentName(pick.agent), modelName(pick.agent, pick.model)];
  if (pick.effort) parts.push(levelName(pick.agent, pick.model, pick.effort));
  return parts.join(" · ");
}

/** What a level does, in the agent's own words. */
export function levelBlurb(agent: AICLI, effort: string): string {
  if (!effort) return effortBlurb("claude", "auto");
  return agent === "claude" || agent === "codex" ? effortBlurb(agent, effort) : "";
}
