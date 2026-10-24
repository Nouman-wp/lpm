import type { DailyModelUsage, DailyProjectUsage, DailyUsage, TokenUsage } from "../../types";

export function tokens(total: number): TokenUsage {
  const input = Math.round(total * 0.8);
  return {
    inputTokens: input,
    cachedInputTokens: Math.round(input / 2),
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: Math.round(input / 2),
    outputTokens: total - input,
    reasoningTokens: 0,
    totalTokens: total,
  };
}

function model(provider: string, total: number): DailyModelUsage {
  return {
    provider,
    model: provider === "claude" ? "claude-sonnet-5" : "gpt-5.6-sol",
    tokens: tokens(total),
  };
}

export interface ProjectSpec {
  project: string;
  provider?: string;
  total: number;
  sessions?: number;
  started?: number;
}

export function projectDay(spec: ProjectSpec): DailyProjectUsage {
  const provider = spec.provider ?? "claude";
  return {
    project: spec.project,
    provider,
    sessions: spec.sessions ?? 1,
    started: spec.started ?? spec.sessions ?? 1,
    models: [model(provider, spec.total)],
  };
}

/** A day made of its projects' rows, its totals adding them up. */
export function day(date: string, specs: ProjectSpec[]): DailyUsage {
  const projects = specs.map(projectDay);
  const models = projects.flatMap((row) => row.models);
  const claudeTokens = models
    .filter((m) => m.provider === "claude")
    .reduce((sum, m) => sum + m.tokens.totalTokens, 0);
  const totalTokens = models.reduce((sum, m) => sum + m.tokens.totalTokens, 0);
  return {
    date,
    claudeTokens,
    codexTokens: totalTokens - claudeTokens,
    totalTokens,
    models,
    projects,
  };
}
