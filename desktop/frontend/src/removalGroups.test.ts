import { describe, expect, it } from "vitest";
import type { ProjectInfo } from "./types";
import {
  deleteWithProjectsLabel,
  folderKeepText,
  partitionRemoval,
  removalConfirmPhrase,
  removalSummary,
  removalTitle,
  unsavedWorkPills,
} from "./removalGroups";

const project = (name: string, parentName?: string) =>
  ({ name, parentName, root: `/code/${name}` }) as ProjectInfo;

describe("partitionRemoval", () => {
  it("splits copies, deleted from disk, from originals, which keep their folders", () => {
    const groups = partitionRemoval([
      project("storefront"),
      project("storefront-1", "storefront"),
      project("api"),
    ]);
    expect(groups.deleted.map((p) => p.name)).toEqual(["storefront-1"]);
    expect(groups.kept.map((p) => p.name)).toEqual(["storefront", "api"]);
  });
});

describe("removalSummary", () => {
  it("says what happens to each group", () => {
    const groups = partitionRemoval([
      project("a"),
      project("b"),
      project("c"),
      project("a-1", "a"),
      project("a-2", "a"),
    ]);
    expect(removalSummary(groups)).toBe(
      "2 folders are deleted from disk. 3 entries leave lpm and keep their folders.",
    );
  });

  it("uses the singular and leaves out an empty group", () => {
    expect(removalSummary(partitionRemoval([project("a-1", "a")]))).toBe(
      "1 folder is deleted from disk.",
    );
    expect(removalSummary(partitionRemoval([project("a")]))).toBe(
      "1 entry leaves lpm and keeps its folder.",
    );
  });
});

describe("removalTitle and removalConfirmPhrase", () => {
  it("count every project", () => {
    expect(removalTitle(1)).toBe("Delete 1 project?");
    expect(removalTitle(5)).toBe("Delete 5 projects?");
    expect(removalConfirmPhrase(5)).toBe("delete 5");
  });
});

describe("unsavedWorkPills", () => {
  it("is empty for a clean copy", () => {
    expect(unsavedWorkPills({ changed: 0, untracked: 0, unpushed: 0, base: null })).toEqual([]);
  });

  it("counts changed and untracked files together, then commits", () => {
    expect(unsavedWorkPills({ changed: 2, untracked: 1, unpushed: 2, base: null })).toEqual([
      "3 uncommitted files",
      "2 unpushed commits",
    ]);
    expect(unsavedWorkPills({ changed: 1, untracked: 0, unpushed: 1, base: "main" })).toEqual([
      "1 uncommitted file",
      "1 commit not on main",
    ]);
  });
});

describe("folder delete wording", () => {
  it("says the projects stay and nothing on disk changes", () => {
    expect(folderKeepText(4)).toBe(
      "Its 4 projects move out of the folder. Nothing on disk changes.",
    );
    expect(folderKeepText(1)).toBe(
      "Its 1 project moves out of the folder. Nothing on disk changes.",
    );
    expect(folderKeepText(0)).toBe("It's empty. Nothing on disk changes.");
  });

  it("counts the projects the red item deletes", () => {
    expect(deleteWithProjectsLabel(1)).toBe("Delete folder and its 1 project…");
    expect(deleteWithProjectsLabel(3)).toBe("Delete folder and its 3 projects…");
  });
});
