import { addDays } from "../../components/stats/statsDates";

const NO_TOKENS = {
  inputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheCreation1hInputTokens: 0,
  cacheReadInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
};

// No agent has run on a fresh install, so every window is empty.
export function emptyStats(days: number) {
  return {
    generatedAt: Date.now(),
    days: days || 1,
    sessions: 0,
    totals: NO_TOKENS,
    providers: [],
    projects: [],
    agents: [],
    daily: [],
    recentSessions: [],
    sources: [],
  };
}

export const EMPTY_USAGE = {
  limits: {},
  accountsStatus: { statuses: [] },
  accountUsage: { usage: {} },
};

export function emptyRecap(week: string) {
  return {
    week,
    days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ date: addDays(week, i), agentMs: 0, prompts: 0 })),
    previousAgentMs: 0,
    sessions: 0,
    projects: [],
    agents: [],
    repos: [],
    linesAdded: 0,
    linesRemoved: 0,
  };
}
