import { describe, expect, it } from "vitest";
import type { JobInfo } from "./jobsFormat";
import {
  machinesNote,
  machinesSummary,
  oneRowPerJob,
  readMachines,
  rowMachinesLabel,
  toggleAnyMachine,
  toggleMachine,
} from "./jobsMachines";
import { machineWords } from "./machineWords";
import { prefixName } from "./peer/markers";

const words = machineWords(true);
const names: Record<string, string> = { a: "Studio", b: "MacBook Pro", c: "Mini" };
const nameOf = (id: string) => names[id] ?? id;

type Row = JobInfo & { project?: string };

function row(over: Partial<Row>): Row {
  return { id: "daily", valid: true, enabled: true, source: "global", ...over };
}

const both = [
  { id: "a", name: "Studio" },
  { id: "b", name: "MacBook Pro" },
];

describe("readMachines", () => {
  it("reads a list or a word, each once, with any last", () => {
    expect(readMachines(["any", "a", " b ", "a", "ANY"])).toEqual(["a", "b", "any"]);
    expect(readMachines("any")).toEqual(["any"]);
    expect(readMachines(undefined)).toEqual([]);
  });
});

describe("toggling computers", () => {
  it("adds after the ones listed and keeps the last unless any is on", () => {
    expect(toggleMachine(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleMachine(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleMachine(["a"], "a")).toEqual(["a"]);
    expect(toggleMachine(["a", "any"], "a")).toEqual(["any"]);
    expect(toggleMachine(["a", "any"], "c")).toEqual(["a", "c", "any"]);
  });

  it("turns any on after the listed ones, or after the fallback", () => {
    expect(toggleAnyMachine(["a"], "a")).toEqual(["a", "any"]);
    expect(toggleAnyMachine([], "a")).toEqual(["a", "any"]);
    expect(toggleAnyMachine(["b", "any"], "a")).toEqual(["b"]);
    expect(toggleAnyMachine(["any"], "a")).toEqual(["a"]);
  });
});

describe("wording", () => {
  it("sums up where it runs", () => {
    expect(machinesSummary([], nameOf, words)).toBe("Every Mac");
    expect(machinesSummary(["a"], nameOf, words)).toBe("Studio");
    expect(machinesSummary(["a", "b"], nameOf, words)).toBe("Studio or MacBook Pro");
    expect(machinesSummary(["a", "b", "c"], nameOf, words)).toBe("3 Macs");
    expect(machinesSummary(["a", "any"], nameOf, words)).toBe("Any Mac");
  });

  it("says who takes it, in order", () => {
    expect(machinesNote(["a"], nameOf, words)).toBe("Only Studio runs it.");
    expect(machinesNote(["a", "b"], nameOf, words)).toBe(
      "Studio runs it when it's on, otherwise MacBook Pro.",
    );
    expect(machinesNote(["a", "any"], nameOf, words)).toBe(
      "Studio runs it when it's on, otherwise another Mac that has it.",
    );
    expect(machinesNote([], nameOf, words)).toBe("Every Mac that has it runs it, each on its own.");
  });

  it("names this computer as this one, others as this one knows them", () => {
    const job = row({ machines: both });
    expect(rowMachinesLabel(job, "a", () => "Gurgen's MBP", words)).toBe("This Mac or Gurgen's MBP");
    expect(rowMachinesLabel(job, "z", () => undefined, words)).toBe("Studio or MacBook Pro");
    expect(rowMachinesLabel(row({}), "a", () => undefined, words)).toBeNull();
  });
});

describe("oneRowPerJob", () => {
  it("keeps the copy from the computer that comes first", () => {
    const mine = row({ machines: both, machineId: "a" });
    const theirs = row({ machines: both, machineId: "b", host: "p" });
    expect(oneRowPerJob([theirs, mine])).toEqual([mine]);
  });

  it("shows the copy that's running", () => {
    const mine = row({ machines: both, machineId: "a" });
    const theirs = row({ machines: both, machineId: "b", host: "p", running: true });
    expect(oneRowPerJob([mine, theirs])).toEqual([theirs]);
  });

  it("matches a project's job across computers by the project's own name", () => {
    const mine = row({ source: "project", project: "lpm", machines: both, machineId: "b" });
    const theirs = row({
      source: "project",
      project: prefixName("aabbccdd", "lpm"),
      machines: both,
      machineId: "a",
      host: "p",
    });
    const other = row({ source: "project", project: "web", machines: both, machineId: "b" });
    expect(oneRowPerJob([mine, theirs, other])).toEqual([theirs, other]);
  });

  it("leaves automations that run on every computer alone", () => {
    const mine = row({});
    const theirs = row({ host: "p" });
    expect(oneRowPerJob([mine, theirs])).toEqual([mine, theirs]);
  });
});
