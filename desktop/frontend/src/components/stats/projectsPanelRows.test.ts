import { describe, expect, it } from "vitest";
import type { PreviousUsage, UsageBreakdown } from "../../types";
import { bucketDays } from "./chartBuckets";
import { projectPanelRows, sortProjectRows } from "./projectsPanelRows";
import { day, tokens } from "./statsFixtures";

const days = [
  day("2026-10-13", [
    { project: "web", total: 300 },
    { project: "api", total: 100, provider: "codex" },
  ]),
  day("2026-10-14", [{ project: "web", total: 100 }]),
];

const breakdown = (key: string, total: number): UsageBreakdown => ({
  key,
  label: key,
  sessions: 1,
  tokens: tokens(total),
});

const previous: PreviousUsage = {
  sessions: 1,
  totals: tokens(200),
  projects: [breakdown("web", 200)],
};

describe("projectPanelRows", () => {
  const rows = projectPanelRows(days, [], bucketDays(days, "day"), previous);
  const web = rows.find((row) => row.key === "web")!;
  const api = rows.find((row) => row.key === "api")!;

  it("shares the total between projects rather than scaling to the biggest", () => {
    expect(web.share).toBeCloseTo(0.8);
    expect(api.share).toBeCloseTo(0.2);
  });

  it("prices each project and compares it with the period before", () => {
    expect(web.cost).toBeGreaterThan(0);
    expect(web.change).toBeCloseTo(1);
    expect(api.change).toBe("new");
    expect(web.spark).toEqual([300, 100]);
  });

  it("falls back to the period's rows, without cost, when no per-project days came", () => {
    const fallback = projectPanelRows(
      days.map(({ projects: _, ...rest }) => rest),
      [breakdown("web", 400)],
      [],
    );
    expect(fallback).toEqual([
      { key: "web", tokens: 400, sessions: 1, cost: null, share: 1, change: null, spark: [] },
    ]);
  });

  it("sorts brand-new projects above every change", () => {
    const sorted = sortProjectRows(rows, "change", true, (key) => key);
    expect(sorted.map((row) => row.key)).toEqual(["api", "web"]);
  });
});
