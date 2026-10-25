import { describe, expect, it } from "vitest";
import {
  agentMix,
  formatAgentTime,
  mixText,
  recapCaption,
  recapView,
  recapWeekStart,
  type WeeklyRecap,
} from "./weeklyRecapModel";

const HOUR = 3_600_000;

function recap(hours: number[], extra: Partial<WeeklyRecap> = {}): WeeklyRecap {
  return {
    week: "2026-10-19",
    days: hours.map((h, i) => ({ date: `2026-10-${19 + i}`, agentMs: h * HOUR, prompts: h * 2 })),
    previousAgentMs: 0,
    sessions: 12,
    projects: [
      { name: "saas-app", agentMs: 4 * HOUR },
      { name: "docs", agentMs: HOUR },
    ],
    agents: [{ name: "claude", agentMs: 5 * HOUR }],
    repos: [],
    linesAdded: 6120,
    linesRemoved: 2407,
    pullRequests: 9,
    ...extra,
  };
}

describe("recapWeekStart", () => {
  it("starts weeks on Monday", () => {
    expect(recapWeekStart("this", "2026-10-25")).toBe("2026-10-19");
    expect(recapWeekStart("last", "2026-10-26")).toBe("2026-10-19");
    expect(recapWeekStart("last", "2026-10-19")).toBe("2026-10-12");
  });
});

describe("formatAgentTime", () => {
  it("reads as hours and minutes", () => {
    expect(formatAgentTime(31 * HOUR + 20 * 60_000)).toBe("31h 20m");
    expect(formatAgentTime(3 * HOUR)).toBe("3h");
    expect(formatAgentTime(45 * 60_000)).toBe("45m");
    expect(formatAgentTime(0)).toBe("0m");
  });
});

describe("agentMix", () => {
  it("shares the agent time out by agent, Claude and Codex by name", () => {
    const mix = agentMix([
      { name: "codex", agentMs: 30 },
      { name: "claude", agentMs: 68 },
      { name: "opencode", agentMs: 2 },
    ]);
    expect(mix.map((s) => [s.label, Math.round(s.percent), s.color])).toEqual([
      ["Claude", 68, "#de8a68"],
      ["Codex", 30, "#2dd4bf"],
      ["Opencode", 2, "#c084fc"],
    ]);
    expect(mixText(mix)).toBe("Claude 68% · Codex 30% · Opencode 2%");
  });

  it("is empty without agent time", () => {
    expect(agentMix([])).toEqual([]);
  });
});

describe("recapView", () => {
  it("shows the week's numbers", () => {
    const view = recapView(recap([5, 0, 0, 0, 0, 0, 0]), "2026-10-27");
    expect(view.hours).toBe("5h");
    expect(view.prompts).toBe("10");
    expect(view.tiles).toEqual([
      { value: "10", label: "prompts sent" },
      { value: "9", label: "pull requests opened" },
    ]);
    expect(view.linesAdded).toBe("+6,120");
    expect(view.linesRemoved).toBe("−2,407");
    expect(view.projects).toBe("2 projects · busiest at 80% of agent time");
    expect(JSON.stringify(view)).not.toContain("saas-app");
    expect(view.empty).toBe(false);
  });

  it("shows growth on last week only once the week is over", () => {
    const week = recap([4, 4, 4, 4, 4, 4, 0], { previousAgentMs: 17 * HOUR });
    expect(recapView(week, "2026-10-26").gain).toBe("↑ 7h on last week");
    expect(recapView(week, "2026-10-24").gain).toBeUndefined();
    expect(recapView({ ...week, previousAgentMs: 30 * HOUR }, "2026-10-26").gain).toBeUndefined();
  });

  it("counts the longest run of active days as the streak", () => {
    const streak = (hours: number[]) => recapView(recap(hours), "2026-10-26").streak;
    expect(streak([1, 1, 1, 1, 1, 1, 0])).toBe("6-day streak");
    expect(streak([1, 0, 1, 1, 0, 1, 0])).toBe("2-day streak");
    expect(streak([1, 0, 1, 0, 1, 0, 0])).toBe("3 active days");
    expect(streak([0, 0, 0, 0, 1, 0, 0])).toBe("1 active day");
    expect(streak([0, 0, 0, 0, 0, 0, 0])).toBe("No active days");
    expect(recapView(recap([1, 1, 0, 0, 0, 0, 0])).days.map((d) => d.on)).toEqual([
      true, true, false, false, false, false, false,
    ]);
  });

  it("falls back to sessions when GitHub couldn't be asked", () => {
    const view = recapView(
      recap([1, 0, 0, 0, 0, 0, 0], { pullRequests: undefined, sessions: 1, projects: [{ name: "a", agentMs: HOUR }] }),
    );
    expect(view.projects).toBe("1 project");
    expect(view.tiles[1]).toEqual({ value: "1", label: "agent session" });
    expect(recapCaption(view)).toBe("My week in lpm: 1h of agents working for me, 2 prompts.");
  });

  it("is empty without agent time", () => {
    expect(recapView(recap([0, 0, 0, 0, 0, 0, 0])).empty).toBe(true);
  });
});
