import { describe, expect, it } from "vitest";
import { configProblems } from "./configProblems";
import { validateYaml } from "./yamlValidation";

describe("configProblems", () => {
  it("reads the line the backend names after a path", () => {
    expect(
      configProblems('services › web › port (line 5): "abc" isn\'t a port number. Use a number such as 3000.'),
    ).toEqual([
      { line: 5, col: 1, message: 'services › web › port: "abc" isn\'t a port number. Use a number such as 3000.' },
    ]);
  });

  it("gives each line of a save check its own problem, skipping the count", () => {
    const error = [
      "services › web › port (line 4): 3000 is also api's port. Each service needs a port of its own.",
      "actions › deploy › cmd (line 9): expected text, found a list",
      "…and 2 more",
    ].join("\n");
    expect(configProblems(error).map((p) => p.line)).toEqual([4, 9]);
  });

  it("reads a parser's line and column, and drops them from the message", () => {
    expect(configProblems("invalid YAML: did not find expected key at line 14 column 5, while parsing a block mapping")).toEqual([
      { line: 14, col: 5, message: "invalid YAML: did not find expected key, while parsing a block mapping" },
    ]);
  });

  it("finds nothing in an error that names no line", () => {
    expect(configProblems("Failed to load: No such file or directory")).toEqual([]);
    expect(configProblems(null)).toEqual([]);
  });

  it("places the editor's syntax error at its line without the parser's snippet", () => {
    const problems = configProblems(validateYaml("services:\n  web:\n    cmd: a\n   port: 3\n"));
    expect(problems).toHaveLength(1);
    expect(problems[0].line).toBe(4);
    expect(problems[0].message).not.toContain("\n");
    expect(problems[0].message).not.toContain(" at line ");
  });
});
