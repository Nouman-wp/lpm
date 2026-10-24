import { describe, expect, it } from "vitest";
import {
  fileStateLabel,
  mergeTitle,
  needsResolving,
  progressLabel,
  remainingFiles,
  stateFromPaths,
  type ConflictFile,
  type MergeState,
} from "./mergeConflicts";

const file = (path: string, conflicts: number, resolved = false): ConflictFile => ({
  path,
  conflicts,
  firstLine: conflicts ? 12 : 0,
  resolved,
});

const state = (files: ConflictFile[], merging = true): MergeState => ({
  merging,
  source: "feature",
  files,
});

describe("merge conflicts", () => {
  it("counts the files resolved so far", () => {
    const s = state([file("a", 3), file("b", 0, true), file("c", 1)]);
    expect(progressLabel(s)).toBe("1 of 3 files resolved");
    expect(remainingFiles(s).map((f) => f.path)).toEqual(["a", "c"]);
    expect(progressLabel(state([file("a", 0, true)]))).toBe("1 of 1 file resolved");
  });

  it("says how a file stands", () => {
    expect(fileStateLabel(file("a", 3))).toBe("3 conflicts");
    expect(fileStateLabel(file("a", 1))).toBe("1 conflict");
    expect(fileStateLabel(file("a", 0))).toBe("no markers left");
    expect(fileStateLabel(file("a", 0, true))).toBe("resolved");
    expect(fileStateLabel(file("a", 0, true), "theirs")).toBe("resolved · used theirs");
    expect(fileStateLabel(file("a", 3), undefined, true)).toBe("");
  });

  it("stays up for a merge that only needs committing", () => {
    expect(needsResolving(state([file("a", 0, true)]))).toBe(true);
    expect(needsResolving(state([file("a", 0, true)], false))).toBe(false);
    expect(needsResolving(state([file("a", 2)], false))).toBe(true);
    expect(needsResolving(state([]))).toBe(false);
  });

  it("names both branches when it knows them", () => {
    expect(mergeTitle(state([]), "main")).toBe("Merging feature into main");
    expect(mergeTitle({ ...state([]), source: "" }, "main")).toBe("Merge conflicts");
    expect(mergeTitle(state([]), "")).toBe("Merging feature");
  });

  it("turns an older Mac's path list into unresolved files", () => {
    expect(stateFromPaths(["a", "b"])).toEqual({
      merging: false,
      source: "",
      legacy: true,
      files: [file("a", 0), file("b", 0)],
    });
  });
});
