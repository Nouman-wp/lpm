import { describe, expect, it } from "vitest";
import { branchSlug, existingBranch, uncommittedNote, upstreamNote } from "./newBranchHints";

const tracking = { hasUpstream: true, ahead: 0, behind: 0 };

describe("branchSlug", () => {
  it("keeps slashes and hyphenates the rest", () => {
    expect(branchSlug("  Fix Login bug ")).toBe("fix-login-bug");
    expect(branchSlug("feat/New Thing")).toBe("feat/new-thing");
    expect(branchSlug("!!!")).toBe("");
  });
});

describe("upstreamNote", () => {
  it("says nothing for a branch that tracks nothing", () => {
    expect(upstreamNote({ ...tracking, hasUpstream: false })).toBeNull();
  });

  it("reads ahead and behind", () => {
    expect(upstreamNote(tracking)).toBe("up to date with origin");
    expect(upstreamNote({ ...tracking, ahead: 2 })).toBe("2 ahead of origin");
    expect(upstreamNote({ ...tracking, behind: 3 })).toBe("3 behind origin");
    expect(upstreamNote({ ...tracking, ahead: 1, behind: 4 })).toBe("1 ahead, 4 behind origin");
  });
});

describe("uncommittedNote", () => {
  it("counts the files that come along", () => {
    expect(uncommittedNote(0)).toBeNull();
    expect(uncommittedNote(1)).toBe("1 uncommitted file comes with you.");
    expect(uncommittedNote(5)).toBe("5 uncommitted files come with you.");
  });
});

describe("existingBranch", () => {
  const local = { name: "fix-login", committerDate: 2 };
  const remote = { name: "fix-login", committerDate: 1, remote: "origin" };

  it("finds an exact name only", () => {
    expect(existingBranch("fix", [[local]])).toBeNull();
    expect(existingBranch("", [[local]])).toBeNull();
  });

  it("prefers the local branch over a remote one", () => {
    expect(existingBranch("fix-login", [[remote], null, [local]])).toBe(local);
    expect(existingBranch("fix-login", [null, [remote]])).toBe(remote);
  });
});
