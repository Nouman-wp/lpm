import { describe, expect, it } from "vitest";
import type { AgentSessionUsage, AgentUsageStats } from "../../types";
import { NO_SCOPE, nextRange, projectDaily, scopeStats } from "./statsScope";
import { day, tokens } from "./statsFixtures";

function session(project: string, startedAt: string, lastAt: string): AgentSessionUsage {
  return {
    provider: "claude",
    project,
    model: "claude-sonnet-5",
    startedAt: new Date(startedAt).getTime(),
    lastAt: new Date(lastAt).getTime(),
    tokens: tokens(1),
  };
}

const daily = [
  day("2026-10-13", [
    { project: "web", total: 100, sessions: 2, started: 2 },
    { project: "api", total: 40, provider: "codex", sessions: 1, started: 1 },
  ]),
  // One of web's two sessions carried on from the day before.
  day("2026-10-14", [{ project: "web", total: 60, sessions: 2, started: 1 }]),
];

const stats = {
  generatedAt: 0,
  days: 30,
  sessions: 4,
  totals: tokens(200),
  providers: [],
  projects: [],
  models: [],
  daily,
  recentSessions: [
    session("web", "2026-10-14T09:00:00", "2026-10-14T10:00:00"),
    session("api", "2026-10-13T09:00:00", "2026-10-13T10:00:00"),
  ],
  sources: [],
  previous: { sessions: 3, totals: tokens(150), projects: [] },
} satisfies AgentUsageStats;

describe("nextRange", () => {
  const day13 = { from: "2026-10-13", to: "2026-10-13" };
  const day15 = { from: "2026-10-15", to: "2026-10-15" };

  it("pins a span and unpins it on a second click", () => {
    expect(nextRange(null, day13, false)).toEqual(day13);
    expect(nextRange(day13, day13, false)).toBeNull();
    expect(nextRange(day13, day15, false)).toEqual(day15);
  });

  it("stretches the pin with Shift", () => {
    expect(nextRange(day15, day13, true)).toEqual({ from: "2026-10-13", to: "2026-10-15" });
  });
});

describe("scopeStats", () => {
  it("leaves the stats alone with nothing pinned", () => {
    expect(scopeStats(stats, NO_SCOPE)).toBe(stats);
  });

  it("narrows everything to a pinned day", () => {
    const scoped = scopeStats(stats, {
      range: { from: "2026-10-14", to: "2026-10-14" },
      project: null,
    });
    expect(scoped.totals.totalTokens).toBe(60);
    expect(scoped.sessions).toBe(2);
    expect(scoped.projects.map((p) => p.key)).toEqual(["web"]);
    expect(scoped.recentSessions.map((s) => s.project)).toEqual(["web"]);
    expect(scoped.previous).toBeUndefined();
  });

  it("counts a session spanning two pinned days once", () => {
    const scoped = scopeStats(stats, {
      range: { from: "2026-10-13", to: "2026-10-14" },
      project: null,
    });
    expect(scoped.totals.totalTokens).toBe(200);
    expect(scoped.sessions).toBe(4);
    expect(scoped.providers.map((p) => [p.key, p.tokens.totalTokens, p.sessions])).toEqual([
      ["claude", 160, 3],
      ["codex", 40, 1],
    ]);
  });

  it("narrows to one project and keeps the comparison", () => {
    const scoped = scopeStats(stats, { range: null, project: "api" });
    expect(scoped.totals.totalTokens).toBe(40);
    expect(scoped.sessions).toBe(1);
    expect(scoped.recentSessions.map((s) => s.project)).toEqual(["api"]);
    expect(scoped.previous).toBe(stats.previous);
    const chart = projectDaily(daily, "api");
    expect(chart.map((d) => [d.codexTokens, d.claudeTokens])).toEqual([
      [40, 0],
      [0, 0],
    ]);
  });

  it("counts listed sessions for a computer that sends no per-project days", () => {
    const older = { ...stats, daily: daily.map(({ projects: _, ...rest }) => rest) };
    const scoped = scopeStats(older, {
      range: { from: "2026-10-14", to: "2026-10-14" },
      project: null,
    });
    expect(scoped.totals.totalTokens).toBe(60);
    expect(scoped.sessions).toBe(1);
  });
});
