import type { DailyModelUsage, DailyProjectUsage, DailyUsage, TokenUsage } from "../../types";

export function emptyTokens(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheCreation1hInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

export function addTokens(into: TokenUsage, add: TokenUsage): void {
  into.inputTokens += add.inputTokens;
  into.cachedInputTokens += add.cachedInputTokens;
  into.cacheCreationInputTokens += add.cacheCreationInputTokens;
  into.cacheCreation1hInputTokens =
    (into.cacheCreation1hInputTokens ?? 0) + (add.cacheCreation1hInputTokens ?? 0);
  into.cacheReadInputTokens += add.cacheReadInputTokens;
  into.outputTokens += add.outputTokens;
  into.reasoningTokens += add.reasoningTokens;
  into.totalTokens += add.totalTokens;
}

export function modelsTotal(models: DailyModelUsage[]): TokenUsage {
  const total = emptyTokens();
  for (const model of models) addTokens(total, model.tokens);
  return total;
}

function sameModel(a: DailyModelUsage, b: DailyModelUsage): boolean {
  return (
    a.provider === b.provider &&
    a.model === b.model &&
    !!a.fast === !!b.fast &&
    !!a.longContext === !!b.longContext
  );
}

function addModels(into: DailyModelUsage[], models: DailyModelUsage[]): void {
  for (const model of models) {
    const existing = into.find((entry) => sameModel(entry, model));
    if (existing) addTokens(existing.tokens, model.tokens);
    else into.push({ ...model, tokens: { ...model.tokens } });
  }
}

// Days must come in date order: a project's first day brings every session it
// ran, each later day only the sessions that began on it, so a session spanning
// several days counts once.
function addProjects(into: DailyProjectUsage[], rows: DailyProjectUsage[]): void {
  for (const row of rows) {
    const existing = into.find(
      (entry) => entry.project === row.project && entry.provider === row.provider,
    );
    if (existing) {
      existing.sessions += row.started;
      existing.started += row.started;
      addModels(existing.models, row.models);
    } else {
      into.push({ ...row, models: row.models.map((m) => ({ ...m, tokens: { ...m.tokens } })) });
    }
  }
}

export function emptyDay(date: string): DailyUsage {
  return { date, claudeTokens: 0, codexTokens: 0, totalTokens: 0, models: [], projects: [] };
}

export function addDay(into: DailyUsage, day: DailyUsage): void {
  into.claudeTokens += day.claudeTokens;
  into.codexTokens += day.codexTokens;
  into.totalTokens += day.totalTokens;
  addModels(into.models, day.models ?? []);
  addProjects((into.projects ??= []), day.projects ?? []);
}

export function foldDays(days: DailyUsage[]): DailyUsage {
  const folded = emptyDay(days[0]?.date ?? "");
  for (const day of days) addDay(folded, day);
  return folded;
}

/** The day as if only `project` had run. */
export function onlyProject(day: DailyUsage, project: string): DailyUsage {
  const rows = (day.projects ?? []).filter((row) => row.project === project);
  const models = rows.flatMap((row) => row.models);
  const claudeTokens = rows
    .filter((row) => row.provider === "claude")
    .reduce((sum, row) => sum + modelsTotal(row.models).totalTokens, 0);
  const totalTokens = modelsTotal(models).totalTokens;
  return {
    date: day.date,
    claudeTokens,
    codexTokens: totalTokens - claudeTokens,
    totalTokens,
    models,
    projects: rows,
  };
}

export function daySessions(day: DailyUsage): number {
  return (day.projects ?? []).reduce((sum, row) => sum + row.sessions, 0);
}
