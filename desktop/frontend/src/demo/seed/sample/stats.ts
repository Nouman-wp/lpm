import type {
  AgentSessionUsage,
  AgentUsageStats,
  DailyModelUsage,
  DailyProjectUsage,
  DailyUsage,
  PreviousUsage,
  TokenUsage,
  UsageBreakdown,
} from "../../../types";
import { DAY, HOUR, MINUTE } from "./clock";

// Millions of tokens a day, oldest first: the last entry is today.
const CLAUDE_SERIES = [
  8.1, 12.4, 4.2, 0.9, 14.8, 17.2, 11.6, 9.4, 6.1, 1.2, 15.9, 21.3, 18.7, 13.2, 10.5, 3.4, 0.6,
  16.8, 19.4, 22.6, 12.9, 8.8, 2.1, 1.4, 17.5, 20.1, 15.3, 11.9, 18.2, 14.2,
];
const CODEX_SERIES = [
  3.2, 4.8, 1.1, 0.4, 5.6, 6.9, 4.4, 3.1, 2.2, 0.5, 6.2, 8.4, 7.1, 5.2, 3.8, 1.2, 0.3, 6.6, 7.8,
  9.1, 4.9, 3.3, 0.8, 0.6, 7.2, 8.1, 5.9, 4.6, 6.8, 8.4,
];
// All time reaches back past the 30 days the series holds, repeating it.
const ALL_TIME_DAYS = 138;
const MILLION = 1_000_000;
const SESSIONS_PER_MTOK = 0.42;

const CLAUDE_MODELS = [
  { model: "claude-fable-5", share: 0.68 },
  { model: "claude-sonnet-5", share: 0.32 },
];
const CODEX_MODEL = "gpt-5.6-sol";

const PROJECT_SHARES = [
  { name: "saas-app", share: 0.39 },
  { name: "auth-service", share: 0.25 },
  { name: "docs-site", share: 0.17 },
  { name: "ml-pipeline", share: 0.13 },
  { name: "mobile-app", share: 0.06 },
];

// Each project's period before against this one, so the Projects panel's
// change column has something to say.
const BEFORE: Record<string, number> = {
  "saas-app": 0.81,
  "auth-service": 0.89,
  "docs-site": 1.09,
  "ml-pipeline": 0.71,
  "mobile-app": 1.43,
};

type Share = { name: string; share: number };

// Each session's last turn `ago` before now, after running for `ran`.
const RECENT = [
  { project: "saas-app", model: "claude-fable-5", tokens: 4_120_000, ago: 14 * MINUTE, ran: 38 },
  { project: "auth-service", model: "claude-fable-5", tokens: 2_640_000, ago: HOUR, ran: 26 },
  { project: "docs-site", model: "claude-sonnet-5", tokens: 980_000, ago: 3 * HOUR, ran: 9 },
  { project: "saas-app", model: CODEX_MODEL, tokens: 3_310_000, ago: 26 * HOUR, ran: 44 },
  { project: "ml-pipeline", model: CODEX_MODEL, tokens: 5_870_000, ago: 29 * HOUR, ran: 71 },
  { project: "mobile-app", model: "claude-fable-5", tokens: 1_240_000, ago: 2 * DAY, ran: 17 },
];

// The day's total split the way an agent's logs split it: mostly input, most
// of that read back from the cache, a third of the output spent reasoning.
function tokens(total: number): TokenUsage {
  const input = Math.round(total * 0.82);
  const output = total - input;
  const cached = Math.round(input * 0.71);
  return {
    inputTokens: input,
    cachedInputTokens: cached,
    cacheCreationInputTokens: Math.round(input * 0.05),
    cacheCreation1hInputTokens: 0,
    cacheReadInputTokens: cached,
    outputTokens: output,
    reasoningTokens: Math.round(output * 0.34),
    totalTokens: total,
  };
}

function sum(rows: TokenUsage[]): TokenUsage {
  return tokens(rows.reduce((n, row) => n + row.totalTokens, 0));
}

const sessionsFor = (total: number) =>
  Math.max(1, Math.round((total / MILLION) * SESSIONS_PER_MTOK));

function dayOf(ago: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ago);
  return d;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function sharesWithout(omit: readonly string[]): Share[] {
  const kept = PROJECT_SHARES.filter((p) => !omit.includes(p.name));
  const whole = kept.reduce((n, p) => n + p.share, 0);
  return kept.map((p) => ({ name: p.name, share: p.share / whole }));
}

// Splits `total` by `shares`, the last part taking what rounding left over.
function split(total: number, shares: Share[]): number[] {
  let left = total;
  return shares.map((p, i) => {
    const part = i === shares.length - 1 ? left : Math.round(total * p.share);
    left -= part;
    return part;
  });
}

const modelsTotal = (models: DailyModelUsage[]) =>
  models.reduce((n, m) => n + m.tokens.totalTokens, 0);

function projectDays(models: DailyModelUsage[], shares: Share[]): DailyProjectUsage[] {
  const rows: DailyProjectUsage[] = [];
  for (const provider of ["claude", "codex"]) {
    const own = models.filter((m) => m.provider === provider);
    const parts = own.map((m) => split(m.tokens.totalTokens, shares));
    shares.forEach((p, i) => {
      const projectModels = own
        .map((m, j) => ({ ...m, tokens: tokens(parts[j][i]) }))
        .filter((m) => m.tokens.totalTokens > 0);
      const total = modelsTotal(projectModels);
      if (total === 0) return;
      const sessions = sessionsFor(total);
      rows.push({
        project: p.name,
        provider,
        sessions,
        started: Math.max(1, Math.round(sessions * 0.6)),
        models: projectModels,
      });
    });
  }
  return rows;
}

function daily(ago: number, shares: Share[]): DailyUsage {
  const i = CLAUDE_SERIES.length - 1 - (ago % CLAUDE_SERIES.length);
  const claude = Math.round(CLAUDE_SERIES[i] * MILLION);
  const codex = Math.round(CODEX_SERIES[i] * MILLION);
  const [lead, rest] = CLAUDE_MODELS;
  const leadTokens = Math.round(claude * lead.share);
  const models: DailyModelUsage[] = [
    { provider: "claude", model: lead.model, tokens: tokens(leadTokens) },
    { provider: "claude", model: rest.model, tokens: tokens(claude - leadTokens) },
    { provider: "codex", model: CODEX_MODEL, tokens: tokens(codex) },
  ];
  return {
    date: isoDate(dayOf(ago)),
    claudeTokens: claude,
    codexTokens: codex,
    totalTokens: claude + codex,
    models,
    projects: projectDays(models, shares),
  };
}

function breakdown(
  key: string,
  label: string,
  usage: TokenUsage,
  provider?: string,
): UsageBreakdown {
  const sessions = sessionsFor(usage.totalTokens);
  return { key, label, sessions, tokens: usage, ...(provider ? { provider } : {}) };
}

const byTokens = (a: UsageBreakdown, b: UsageBreakdown) =>
  b.tokens.totalTokens - a.tokens.totalTokens || a.label.localeCompare(b.label);

function projects(window: DailyUsage[], shares: Share[]): UsageBreakdown[] {
  return shares
    .map((p) => {
      const total = window
        .flatMap((day) => day.projects ?? [])
        .filter((row) => row.project === p.name)
        .reduce((n, row) => n + modelsTotal(row.models), 0);
      return breakdown(p.name, p.name, tokens(total));
    })
    .sort(byTokens);
}

function previous(days: number, shares: Share[]): PreviousUsage | undefined {
  if (days !== 7 && days !== 30) return undefined;
  const before = Array.from({ length: days }, (_, i) => daily(days + i, shares));
  const rows = projects(before, shares).map((row) =>
    breakdown(
      row.key,
      row.label,
      tokens(Math.round(row.tokens.totalTokens * (BEFORE[row.key] ?? 1))),
    ),
  );
  const total = rows.reduce((n, row) => n + row.tokens.totalTokens, 0);
  return { sessions: sessionsFor(total), totals: tokens(total), projects: rows.sort(byTokens) };
}

function recent(since: number, omit: readonly string[]): AgentSessionUsage[] {
  const now = Date.now();
  return RECENT.filter((s) => now - s.ago >= since && !omit.includes(s.project)).map((s) => ({
    provider: s.model === CODEX_MODEL ? "codex" : "claude",
    project: s.project,
    model: s.model,
    startedAt: now - s.ago - s.ran * MINUTE,
    lastAt: now - s.ago,
    tokens: tokens(s.tokens),
  }));
}

/** `agent_usage_stats` for the last `days` days (0 is all time), without the
 *  projects in `omit`. */
export function sampleStats(days: number, omit: readonly string[] = []): AgentUsageStats {
  const span = days > 0 ? days : ALL_TIME_DAYS;
  const shares = sharesWithout(omit);
  const window = Array.from({ length: span }, (_, i) => daily(span - 1 - i, shares));
  const models = window.flatMap((d) => d.models);
  const modelRows = [...new Set(models.map((m) => m.model))].map((model) => {
    const rows = models.filter((m) => m.model === model);
    return breakdown(model, model, sum(rows.map((m) => m.tokens)), rows[0].provider);
  });
  const claude = window.reduce((n, d) => n + d.claudeTokens, 0);
  const codex = window.reduce((n, d) => n + d.codexTokens, 0);
  const providers = [
    breakdown("claude", "Claude Code", tokens(claude)),
    breakdown("codex", "Codex", tokens(codex)),
  ];
  const totals = tokens(claude + codex);
  const since = days > 0 ? dayOf(days - 1).getTime() : 0;
  return {
    generatedAt: Date.now(),
    days,
    sessions: providers.reduce((n, p) => n + p.sessions, 0),
    totals,
    providers: providers.sort(byTokens),
    projects: projects(window, shares),
    models: modelRows.sort(byTokens),
    daily: window,
    recentSessions: recent(since, omit),
    sources: providers.map((p) => ({ provider: p.key, files: p.sessions })),
    previous: previous(days, shares),
  };
}
