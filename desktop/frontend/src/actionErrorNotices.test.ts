import { describe, expect, it } from "vitest";
import { actionErrorNotices } from "./actionErrorNotices";
import type { ProjectInfo } from "./types";

const project = (name: string, actionErrors?: string[]) => ({ name, actionErrors }) as ProjectInfo;

describe("actionErrorNotices", () => {
  it("names each problem once, under the first project that has it", () => {
    const notices = actionErrorNotices([
      project("api", ["actions › pick: bad"]),
      project("api-1", ["actions › pick: bad"]),
      project("web"),
      project("blog", ["template tools: actions › x: bad"]),
    ]);
    expect([...notices.values()].map((n) => [n.project.name, n.error])).toEqual([
      ["api", "actions › pick: bad"],
      ["blog", "template tools: actions › x: bad"],
    ]);
  });

  it("treats a problem that only moved to another line as the same one", () => {
    const before = actionErrorNotices([project("api", ["actions › pick (line 30): bad"])]);
    const after = actionErrorNotices([project("api", ["actions › pick (line 26): bad"])]);
    expect([...after.keys()]).toEqual([...before.keys()]);
  });
});
