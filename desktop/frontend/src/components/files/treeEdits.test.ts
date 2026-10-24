import { describe, expect, it } from "vitest";
import {
  DRAFT_PATH,
  folderFor,
  nameTarget,
  namesIn,
  renamedPath,
  withDraftRow,
  withoutPending,
} from "./treeEdits";
import type { Listing, TreeRow } from "./treeModel";

const row = (path: string, isDir: boolean, depth: number): TreeRow => ({
  path,
  isDir,
  name: path.split("/").pop() ?? path,
  depth,
  expanded: isDir,
  loading: false,
  error: null,
});

const ROWS = [row("src", true, 0), row("src/a.ts", false, 1), row("src/lib", true, 1), row("README.md", false, 0)];

describe("folderFor", () => {
  it("is the folder itself, or the file's own", () => {
    expect(folderFor({ path: "src/lib", isDir: true })).toBe("src/lib");
    expect(folderFor({ path: "src/a.ts", isDir: false })).toBe("src");
    expect(folderFor({ path: "README.md", isDir: false })).toBe("");
    expect(folderFor(null)).toBe("");
  });
});

describe("withDraftRow", () => {
  it("opens a blank row at the top of the folder, one level in", () => {
    const rows = withDraftRow(ROWS, { kind: "create", dir: "src", isDir: false });
    expect(rows.map((r) => [r.path, r.depth])).toEqual([
      ["src", 0],
      [DRAFT_PATH, 1],
      ["src/a.ts", 1],
      ["src/lib", 1],
      ["README.md", 0],
    ]);
    expect(rows[1].isDir).toBe(false);
  });

  it("puts a root entry first", () => {
    const rows = withDraftRow(ROWS, { kind: "create", dir: "", isDir: true });
    expect(rows[0]).toMatchObject({ path: DRAFT_PATH, depth: 0, isDir: true });
  });

  it("leaves the rows be for a rename, or a folder that isn't on screen", () => {
    expect(withDraftRow(ROWS, { kind: "rename", path: "src/a.ts", isDir: false })).toBe(ROWS);
    expect(withDraftRow(ROWS, { kind: "create", dir: "docs", isDir: false })).toBe(ROWS);
    expect(withDraftRow(ROWS, null)).toBe(ROWS);
  });
});

describe("withoutPending", () => {
  it("hides an entry on its way to the Trash and everything in it", () => {
    expect(withoutPending(ROWS, ["src"]).map((r) => r.path)).toEqual(["README.md"]);
    expect(withoutPending(ROWS, ["src/a.ts"]).map((r) => r.path)).toEqual(["src", "src/lib", "README.md"]);
    expect(withoutPending(ROWS, ["sr"])).toEqual(ROWS);
    expect(withoutPending(ROWS, [])).toBe(ROWS);
  });
});

describe("namesIn", () => {
  it("lists a loaded folder's names and nothing for one still loading", () => {
    const listings = new Map<string, Listing>([
      ["", { status: "ready", entries: [{ name: "src", isDir: true }, { name: "a.ts", isDir: false }] }],
      ["src", { status: "loading" }],
    ]);
    expect(namesIn(listings, "")).toEqual(["src", "a.ts"]);
    expect(namesIn(listings, "src")).toEqual([]);
    expect(namesIn(listings, "docs")).toEqual([]);
  });
});

describe("renames", () => {
  it("names the new entry beside the old one, or in the folder it is made in", () => {
    expect(nameTarget({ kind: "rename", path: "src/a.ts", isDir: false }, "b.ts")).toBe("src/b.ts");
    expect(nameTarget({ kind: "create", dir: "src", isDir: true }, "lib2")).toBe("src/lib2");
    expect(nameTarget({ kind: "create", dir: "", isDir: false }, "x.md")).toBe("x.md");
  });

  it("follows a path through its folder's rename", () => {
    expect(renamedPath("src/a.ts", "src", "app")).toBe("app/a.ts");
    expect(renamedPath("src/a.ts", "src/a.ts", "src/b.ts")).toBe("src/b.ts");
    expect(renamedPath("srcs/a.ts", "src", "app")).toBeNull();
  });
});
