import { describe, expect, it } from "vitest";
import { gutterDigits, hunkLabel, parseDiffRows, type DiffRow } from "./diffRows";

const code = (rows: DiffRow[]) =>
  rows.flatMap((r) => (r.kind === "code" ? [[r.type, r.oldNo, r.newNo, r.text]] : []));

describe("parseDiffRows", () => {
  it("numbers both sides of a hunk and drops the file header", () => {
    const diff = [
      "diff --git a/cart.ts b/cart.ts",
      "index 1111111..2222222 100644",
      "--- a/cart.ts",
      "+++ b/cart.ts",
      "@@ -118,4 +118,5 @@ function total(cart)",
      " const a = 1;",
      "-const b = 2;",
      "+const b = 3;",
      "+const c = 4;",
      " return a;",
      " }",
    ].join("\n");
    const rows = parseDiffRows(diff);
    expect(rows[0]).toEqual({ kind: "hunk", line: 118, section: "function total(cart)" });
    expect(code(rows)).toEqual([
      ["ctx", 118, 118, "const a = 1;"],
      ["del", 119, null, "const b = 2;"],
      ["add", null, 119, "const b = 3;"],
      ["add", null, 120, "const c = 4;"],
      ["ctx", 120, 121, "return a;"],
      ["ctx", 121, 122, "}"],
    ]);
  });

  it("starts each hunk at its own header's lines", () => {
    const diff = "@@ -1,2 +1,2 @@\n-a\n+A\n b\n@@ -40 +40,2 @@ section\n x\n+y";
    const rows = parseDiffRows(diff);
    expect(rows.filter((r) => r.kind === "hunk")).toEqual([
      { kind: "hunk", line: 1, section: "" },
      { kind: "hunk", line: 40, section: "section" },
    ]);
    expect(code(rows).slice(3)).toEqual([
      ["ctx", 40, 40, "x"],
      ["add", null, 41, "y"],
    ]);
  });

  it("keeps a trimmed blank context line inside the hunk, not after it", () => {
    const rows = parseDiffRows("@@ -1,3 +1,3 @@\n-a\n+b\n c\n\n");
    expect(code(rows)).toEqual([
      ["del", 1, null, "a"],
      ["add", null, 1, "b"],
      ["ctx", 2, 2, "c"],
      ["ctx", 3, 3, ""],
    ]);
    expect(rows).toHaveLength(5);
  });

  it("skips the missing-newline marker", () => {
    const rows = parseDiffRows("@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n\\ No newline at end of file");
    expect(code(rows)).toEqual([
      ["del", 1, null, "a"],
      ["add", null, 1, "b"],
    ]);
  });

  it("labels a new file's hunk from its first line and keeps loose notes", () => {
    const rows = parseDiffRows("Binary files a/x.png and b/x.png differ\n@@ -0,0 +1,2 @@\n+one\n+two");
    expect(rows[0]).toEqual({ kind: "note", text: "Binary files a/x.png and b/x.png differ" });
    expect(rows[1]).toEqual({ kind: "hunk", line: 1, section: "" });
    const deleted = parseDiffRows("@@ -1,2 +0,0 @@\n-one\n-two");
    expect(deleted[0]).toEqual({ kind: "hunk", line: 1, section: "" });
  });
});

describe("hunk bar and gutter", () => {
  it("names the start line and the section git found", () => {
    expect(hunkLabel({ line: 118, section: "function total(cart)" })).toBe("⋯ line 118 · function total(cart)");
    expect(hunkLabel({ line: 3, section: "" })).toBe("⋯ line 3");
  });

  it("sizes the gutter to the widest number", () => {
    expect(gutterDigits(parseDiffRows("@@ -998,3 +998,4 @@\n a\n+b\n c\n d"))).toBe(4);
    expect(gutterDigits(parseDiffRows("@@ -1 +1 @@\n-a\n+b"))).toBe(2);
  });
});
