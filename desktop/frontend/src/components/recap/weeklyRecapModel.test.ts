import { describe, expect, it } from "vitest";
import {
  agentMix,
  formatAgentTime,
  mixText,
  normalizeRecapRows,
  recapCaption,
  recapView,
  recapWeekStart,
  withoutRows,
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
    workedRepos: [],
    linesAdded: 6120,
    linesRemoved: 2407,
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
    expect(mixText(mix)).toBe("Claude 68%, Codex 30%, Opencode 2%");
    expect(mixText(agentMix([{ name: "claude", agentMs: 5 }]))).toBe("All Claude");
  });

  it("is empty without agent time", () => {
    expect(agentMix([])).toEqual([]);
  });
});

describe("recapView", () => {
  it("shows the week's numbers", () => {
    const view = recapView(recap([5, 0, 0, 0, 0, 0, 0]), "2026-10-27");
    expect(view.hours).toBe("5h");
    expect(view.tiles).toEqual([
      { id: "prompts", value: "10", label: "prompts" },
      { id: "sessions", value: "12", label: "agent sessions" },
    ]);
    expect(view.lines).toEqual({ added: "+6,120", removed: "−2,407" });
    expect(recapCaption(view)).toBe("My week in lpm: 5h of agents working for me, 10 prompts.");
    expect(JSON.stringify(view)).not.toContain("saas-app");
    expect(JSON.stringify(view)).not.toContain("project");
    expect(view.empty).toBe(false);
  });

  it("shortens big line counts to fit a quarter of the card", () => {
    const lines = (linesAdded: number, linesRemoved: number) => {
      const view = recapView(recap([1, 0, 0, 0, 0, 0, 0], { linesAdded, linesRemoved }));
      return [view.lines?.added, view.lines?.removed];
    };
    expect(lines(9_999, 664_224)).toEqual(["+9,999", "−664k"]);
    expect(lines(999_600, 2_000_000)).toEqual(["+1M", "−2M"]);
  });

  it("shows growth on last week only once the week is over", () => {
    const week = recap([4, 4, 4, 4, 4, 4, 0], { previousAgentMs: 17 * HOUR });
    expect(recapView(week, "2026-10-26").gain).toBe("↑ 7h on last week");
    expect(recapView(week, "2026-10-24").gain).toBeUndefined();
    expect(recapView({ ...week, previousAgentMs: 30 * HOUR }, "2026-10-26").gain).toBeUndefined();
  });

  it("measures each day against the week's busiest", () => {
    expect(recapView(recap([1, 1, 0, 0, 0, 0, 0])).days.map((d) => d.on)).toEqual([
      true, true, false, false, false, false, false,
    ]);
    expect(recapView(recap([2, 4, 0, 1, 0, 0, 0])).days.map((d) => d.level)).toEqual([
      0.5, 1, 0, 0.25, 0, 0, 0,
    ]);
  });

  it("leaves the rows picked off the card and its caption", () => {
    const full = recapView(recap([5, 0, 0, 0, 0, 0, 0]), "2026-10-27");
    const view = withoutRows(full, ["sessions", "lines", "agents"]);
    expect(view.tiles.map((tile) => tile.id)).toEqual(["prompts"]);
    expect(view.lines).toBeUndefined();
    expect(view.mix).toEqual([]);
    expect(view.hours).toBe("5h");
    expect(recapCaption(view)).toBe("My week in lpm: 5h of agents working for me, 10 prompts.");
    expect(withoutRows(full, [])).toBe(full);
  });

  it("keeps only rows it knows from settings", () => {
    expect(normalizeRecapRows(["agents", "days", "prompts"])).toEqual(["prompts", "agents"]);
    expect(normalizeRecapRows(["projects", "days"])).toBeUndefined();
    expect(normalizeRecapRows("agents")).toBeUndefined();
  });

  it("is empty without agent time", () => {
    expect(recapView(recap([0, 0, 0, 0, 0, 0, 0])).empty).toBe(true);
  });
});
