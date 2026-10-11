import { describe, expect, it } from "vitest";
import { changedUnder, selectionChecks } from "./commitChecks";

const paths = ["src/a.ts", "src/lib/b.ts", "src/lib/c.ts", "README.md"];

describe("selectionChecks", () => {
  it("marks files and rolls folders up from them", () => {
    const checks = selectionChecks(paths, new Set(["src/a.ts", "src/lib/b.ts", "README.md"]));
    expect(checks.get("src/a.ts")).toBe("all");
    expect(checks.get("src/lib/c.ts")).toBe("none");
    expect(checks.get("src/lib")).toBe("some");
    expect(checks.get("src")).toBe("some");
    expect(checks.get("README.md")).toBe("all");
  });

  it("is all or none for a folder whose files agree", () => {
    const checks = selectionChecks(paths, new Set(["src/lib/b.ts", "src/lib/c.ts"]));
    expect(checks.get("src/lib")).toBe("all");
    expect(selectionChecks(paths, new Set()).get("src")).toBe("none");
  });
});

describe("changedUnder", () => {
  it("lists a folder's files and a file itself, not lookalike siblings", () => {
    expect(changedUnder([...paths, "src/libx.ts"], "src/lib")).toEqual(["src/lib/b.ts", "src/lib/c.ts"]);
    expect(changedUnder(paths, "README.md")).toEqual(["README.md"]);
  });
});
