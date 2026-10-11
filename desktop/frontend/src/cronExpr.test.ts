import { describe, expect, it } from "vitest";
import {
  cronFieldAt,
  cronRunsBetween,
  cronTokenRange,
  nextCronRuns,
  parseCron,
  withCronField,
  type CronSpec,
} from "./cronExpr";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime() / 1000;

function spec(expr: string): CronSpec {
  const parsed = parseCron(expr);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.spec;
}

describe("parseCron", () => {
  it("reads lists, ranges, steps and names", () => {
    const s = spec("15 9-17/4 * jan,JUL MON-fri");
    expect([...s.sets.minute]).toEqual([15]);
    expect([...s.sets.hour]).toEqual([9, 13, 17]);
    expect([...s.sets.month]).toEqual([1, 7]);
    expect([...s.sets.dow].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(s.domAny && !s.dowAny).toBe(true);
  });

  it("folds 7 onto Sunday and expands shorthands", () => {
    expect([...spec("0 0 * * 7").sets.dow]).toEqual([0]);
    expect(spec("@weekly").tokens).toEqual(["0", "0", "*", "*", "0"]);
    expect(spec("  0   9 * *  1 ").source).toBe("0 9 * * 1");
  });

  it("explains what's wrong, naming the field", () => {
    expect(parseCron("0 9 * *")).toMatchObject({ ok: false, error: expect.stringContaining("five fields") });
    expect(parseCron("60 9 * * *")).toMatchObject({ ok: false, field: "minute", error: expect.stringContaining("0–59") });
    expect(parseCron("0 17-9 * * *")).toMatchObject({ ok: false, field: "hour", error: expect.stringContaining("backwards") });
    expect(parseCron("0 9 * * funday")).toMatchObject({ ok: false, field: "dow" });
    expect(parseCron("0 9 1-2-3 * *")).toMatchObject({ ok: false, field: "dom" });
    expect(parseCron("@reboot")).toMatchObject({ ok: false });
    expect(parseCron("")).toMatchObject({ ok: false });
  });

  it("keeps to the 5-minute floor and refuses impossible dates", () => {
    expect(parseCron("* * * * *")).toMatchObject({ ok: false, error: expect.stringContaining("every 5 minutes") });
    expect(parseCron("58,2 * * * *").ok).toBe(false);
    expect(parseCron("58,2 9 * * *").ok).toBe(true);
    expect(parseCron("*/5 * * * *").ok).toBe(true);
    expect(parseCron("0 0 30 2 *")).toMatchObject({ ok: false, error: expect.stringContaining("never runs") });
    expect(parseCron("0 0 29 2 *").ok).toBe(true);
  });
});

describe("cron runs", () => {
  it("lists the next runs after a moment", () => {
    // Friday 2026-07-10, noon.
    expect(nextCronRuns(spec("0 18 * * 5"), at(2026, 7, 10, 12), 2)).toEqual([
      at(2026, 7, 10, 18),
      at(2026, 7, 17, 18),
    ]);
  });

  it("matches either day field when both are set", () => {
    const runs = nextCronRuns(spec("0 9 1 * mon"), at(2026, 6, 30, 12), 2);
    expect(runs).toEqual([at(2026, 7, 1, 9), at(2026, 7, 6, 9)]);
    expect(nextCronRuns(spec("0 9 */2 * mon"), at(2026, 6, 30, 12), 1)).toEqual([at(2026, 7, 13, 9)]);
  });

  it("reaches a leap day years away", () => {
    expect(nextCronRuns(spec("0 0 29 2 *"), at(2026, 7, 1), 1)).toEqual([at(2028, 2, 29)]);
  });

  it("lays out every run inside a window", () => {
    const runs = cronRunsBetween(spec("0 9,17 * * *"), at(2026, 7, 10), at(2026, 7, 11, 23, 59), 100);
    expect(runs).toEqual([at(2026, 7, 10, 9), at(2026, 7, 10, 17), at(2026, 7, 11, 9), at(2026, 7, 11, 17)]);
  });
});

describe("editing helpers", () => {
  it("replaces one field, filling out a short line", () => {
    expect(withCronField("0 18 * * 5", "hour", "9,17")).toBe("0 9,17 * * 5");
    expect(withCronField("0 18", "dow", "1-5")).toBe("0 18 * * 1-5");
    expect(withCronField("@daily", "dow", "1")).toBe("0 0 * * 1");
  });

  it("finds the field under the caret", () => {
    expect(cronFieldAt("0 18 * * 5", 0)).toBe("minute");
    expect(cronFieldAt("0 18 * * 5", 3)).toBe("hour");
    expect(cronFieldAt("0 18 * * 5", 10)).toBe("dow");
    expect(cronFieldAt("0 ", 2)).toBe("hour");
    expect(cronFieldAt("@daily", 3)).toBeNull();
  });

  it("finds where a field's text sits, to select it", () => {
    expect(cronTokenRange("0 18 * * 5", "hour")).toEqual([2, 4]);
    expect(cronTokenRange("  0  18 * * 5", "minute")).toEqual([2, 3]);
    expect(cronTokenRange("0 18", "dow")).toBeNull();
    expect(cronTokenRange("@daily", "hour")).toBeNull();
  });
});
