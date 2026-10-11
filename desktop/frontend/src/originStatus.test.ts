import { describe, expect, it } from "vitest";
import {
  heldByChanges,
  originActionLabel,
  originDoneText,
  originHeldTitle,
  originMark,
  originMarkTitle,
  sameOriginStatus,
  type OriginStatus,
} from "./originStatus";

const status = (over: Partial<OriginStatus> = {}): OriginStatus => ({
  branch: "main",
  hasUpstream: true,
  ahead: 0,
  behind: 0,
  base: "",
  baseBehind: 0,
  conflicted: false,
  changes: 0,
  fetched: true,
  ...over,
});

describe("originMark", () => {
  it("says nothing when origin has nothing new", () => {
    expect(originMark(undefined)).toBeNull();
    expect(originMark(status())).toBeNull();
    expect(originMark(status({ ahead: 2 }))).toBeNull();
    expect(originMark(status({ branch: "", behind: 4 }))).toBeNull();
  });

  it("counts new commits on the upstream", () => {
    const mark = originMark(status({ behind: 3 }))!;
    expect(mark).toEqual({ kind: "behind", behind: 3 });
    expect(originActionLabel(mark)).toBe("↓ Pull 3");
    expect(originDoneText(mark)).toBe("Pulled 3");
    expect(originMarkTitle(mark, "main")).toBe("Origin has 3 new commits on main");
  });

  it("turns into Sync when unpushed commits sit under the news", () => {
    const mark = originMark(status({ ahead: 2, behind: 1 }))!;
    expect(mark).toEqual({ kind: "diverged", ahead: 2, behind: 1 });
    expect(originActionLabel(mark)).toBe("Sync");
    expect(originMarkTitle(mark, "main")).toBe(
      "Origin has 1 new commit on main, and 2 of yours aren’t pushed",
    );
  });

  it("measures a branch without upstream against origin's default branch", () => {
    const mark = originMark(
      status({ branch: "demo-tour", hasUpstream: false, base: "main", baseBehind: 12 }),
    )!;
    expect(mark).toEqual({ kind: "base", base: "main", behind: 12, onBase: false });
    expect(originActionLabel(mark)).toBe("Update");
    expect(originDoneText(mark)).toBe("Updated from main");
  });

  it("reads the default branch itself, untracked, as a plain pull", () => {
    const mark = originMark(status({ hasUpstream: false, base: "main", baseBehind: 2 }))!;
    expect(mark).toMatchObject({ onBase: true });
    expect(originActionLabel(mark)).toBe("↓ Pull 2");
  });

  it("puts a stopped pull ahead of any count", () => {
    const mark = originMark(status({ behind: 5, conflicted: true }))!;
    expect(mark).toEqual({ kind: "conflict" });
    expect(originActionLabel(mark)).toBe("Resolve");
  });
});

describe("heldByChanges", () => {
  const held = (over: Partial<OriginStatus>, autostash = false) => {
    const st = status(over);
    return heldByChanges(st, originMark(st), autostash);
  };

  it("holds back a catch-up while tracked files have uncommitted changes", () => {
    expect(held({ behind: 1, changes: 3 })).toBe(true);
    expect(held({ ahead: 2, behind: 1, changes: 1 })).toBe(true);
    expect(held({ hasUpstream: false, base: "main", baseBehind: 2, changes: 1 })).toBe(true);
    expect(held({ behind: 1 })).toBe(false);
  });

  it("lets an autostash pull through, but not a merge", () => {
    expect(held({ behind: 1, changes: 3 }, true)).toBe(false);
    expect(held({ hasUpstream: false, base: "main", baseBehind: 2, changes: 1 }, true)).toBe(true);
  });

  it("leaves a conflict to show as one", () => {
    expect(held({ behind: 1, conflicted: true, changes: 2 })).toBe(false);
  });

  it("says what is in the way", () => {
    const st = status({ behind: 1, changes: 3 });
    expect(originHeldTitle(originMark(st)!, st)).toBe(
      "Origin has 1 new commit on main. 3 files here have uncommitted changes: commit or stash them first",
    );
  });
});

describe("sameOriginStatus", () => {
  it("ignores whether the last fetch landed", () => {
    expect(sameOriginStatus(status({ fetched: true }), status({ fetched: false }))).toBe(true);
    expect(sameOriginStatus(status(), status({ behind: 1 }))).toBe(false);
    expect(sameOriginStatus(status({ behind: 1 }), status({ behind: 1, changes: 2 }))).toBe(false);
    expect(sameOriginStatus(undefined, status())).toBe(false);
  });
});
