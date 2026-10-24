import { describe, expect, it } from "vitest";
import { entryNameProblem, type NameRules } from "./entryName";

const MAC: NameRules = { caseSensitive: false, windows: false };
const LINUX: NameRules = { caseSensitive: true, windows: false };
const WINDOWS: NameRules = { caseSensitive: false, windows: true };
const SIBLINGS = ["src", "README.md", "package.json"];

describe("entryNameProblem", () => {
  it("takes an ordinary new name", () => {
    expect(entryNameProblem("main.ts", SIBLINGS, null, MAC)).toBeNull();
    expect(entryNameProblem(".env", SIBLINGS, null, LINUX)).toBeNull();
  });

  it("refuses names a path can't hold", () => {
    expect(entryNameProblem("", SIBLINGS, null, MAC)).toBe("Enter a name");
    expect(entryNameProblem("   ", SIBLINGS, null, MAC)).toBe("Enter a name");
    expect(entryNameProblem(".", SIBLINGS, null, MAC)).toBe('"." isn\'t a valid name');
    expect(entryNameProblem("..", SIBLINGS, null, MAC)).toBe('".." isn\'t a valid name');
    expect(entryNameProblem("a/b", SIBLINGS, null, MAC)).toBe("A name can't contain / or \\");
    expect(entryNameProblem("a\\b", SIBLINGS, null, MAC)).toBe("A name can't contain / or \\");
    expect(entryNameProblem("tab\there", SIBLINGS, null, MAC)).toBe("A name can't contain control characters");
  });

  it("says when the name is taken, by the disk's idea of case", () => {
    expect(entryNameProblem("src", SIBLINGS, null, MAC)).toBe("src already exists");
    expect(entryNameProblem("readme.md", SIBLINGS, null, MAC)).toBe("readme.md already exists");
    expect(entryNameProblem("readme.md", SIBLINGS, null, LINUX)).toBeNull();
  });

  it("lets a rename keep its name or respell it", () => {
    expect(entryNameProblem("readme.md", SIBLINGS, "README.md", MAC)).toBeNull();
    expect(entryNameProblem("README.md", SIBLINGS, "README.md", MAC)).toBeNull();
    expect(entryNameProblem("src", SIBLINGS, "README.md", MAC)).toBe("src already exists");
  });

  it("holds Windows names to Windows rules", () => {
    expect(entryNameProblem("a:b", [], null, WINDOWS)).toBe('A name can\'t contain < > : " | ? *');
    expect(entryNameProblem("notes.", [], null, WINDOWS)).toBe("A name can't end with a dot or a space");
    expect(entryNameProblem("con", [], null, WINDOWS)).toBe('"con" is reserved by Windows');
    expect(entryNameProblem("LPT1.txt", [], null, WINDOWS)).toBe('"LPT1.txt" is reserved by Windows');
    expect(entryNameProblem("console.log", [], null, WINDOWS)).toBeNull();
    expect(entryNameProblem("a:b", [], null, MAC)).toBeNull();
  });
});
