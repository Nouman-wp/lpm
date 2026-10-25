import { describe, expect, it, vi } from "vitest";

vi.mock("../bridge/commands", () => ({
  AcceptClaudePoolPick: vi.fn(),
  ClaudePoolState: vi.fn(),
  ResumeClaudePool: vi.fn(),
  SetClaudePool: vi.fn(),
  LoadClaudeAccounts: vi.fn(async () => ({ accounts: [] })),
  SaveClaudeAccounts: vi.fn(),
  RemoveClaudeAccount: vi.fn(),
  ClaudeAccountsStatus: vi.fn(async () => ({ statuses: [] })),
  ClaudeAccountUsage: vi.fn(async () => ({ usage: {} })),
}));
vi.mock("../bridge/runtime", () => ({
  EventsOn: vi.fn(() => () => {}),
}));

import { projectJobAccount } from "./claudeProjectPool";
import { jobAccountInUse, jobAccountNote, jobDefaultAccount } from "./jobAccount";
import type { ProjectInfo } from "./types";

const registered = ["work", "side"];

function project(fields: Partial<ProjectInfo>): ProjectInfo {
  return { name: "api", isRemote: false, ...fields } as ProjectInfo;
}

const api = project({ claudeAccount: "work" });
const web = project({ name: "web" });
const projects = [api, web];
const label = (id: string) => (id === "default" ? "Main login" : id[0].toUpperCase() + id.slice(1));
const name = (p: string) => p;

describe("projectJobAccount", () => {
  it("uses a pin to a registered account, else the main login", () => {
    expect(projectJobAccount(api, [], registered)).toBe("work");
    expect(projectJobAccount(project({ claudeAccount: "gone" }), [], registered)).toBe("default");
    expect(projectJobAccount(project({ claudeAccount: "" }), [], registered)).toBe("default");
  });

  it("uses the first known account of a list, never switching", () => {
    expect(projectJobAccount(project({ claudeAccounts: ["gone", "side", "work"] }), [], registered)).toBe("side");
    expect(projectJobAccount(project({ claudeAccounts: ["gone"] }), [], registered)).toBe("default");
  });

  it("follows the parent on a copy and uses the main login with no keys", () => {
    const copy = project({ name: "api-2", parentName: "api" });
    expect(projectJobAccount(copy, [api, copy], registered)).toBe("work");
    expect(projectJobAccount(web, [], registered)).toBe("default");
  });
});

describe("jobDefaultAccount", () => {
  it("is the main login for a standalone automation", () => {
    expect(jobDefaultAccount({ targets: [], everyProject: false }, projects, registered)).toBe("default");
  });

  it("is the project's account, or null when its projects differ", () => {
    expect(jobDefaultAccount({ targets: ["api"], everyProject: false }, projects, registered)).toBe("work");
    expect(jobDefaultAccount({ targets: ["api", "web"], everyProject: false }, projects, registered)).toBeNull();
    expect(jobDefaultAccount({ targets: [], everyProject: true }, projects, registered)).toBeNull();
  });
});

describe("jobAccountInUse", () => {
  it("follows the projects without a choice and reads '' as the main login", () => {
    expect(jobAccountInUse(null, "work", registered)).toBe("work");
    expect(jobAccountInUse("", "work", registered)).toBe("default");
    expect(jobAccountInUse("side", "work", registered)).toBe("side");
  });

  it("falls back to the projects for an account that's gone", () => {
    expect(jobAccountInUse("gone", "work", registered)).toBe("work");
  });
});

describe("jobAccountNote", () => {
  const one = { targets: ["api"], everyProject: false };
  const note = (scope: typeof one, choice: string | null, fallback: string | null) =>
    jobAccountNote(scope, choice, registered, jobAccountInUse(choice, fallback, registered), fallback, label, name);

  it("says nothing when the runs use the project's account", () => {
    expect(note(one, null, "work")).toBeNull();
    expect(note(one, "work", "work")).toBeNull();
  });

  it("names what changes for one project, several, or none", () => {
    expect(note(one, "side", "work")).toBe(
      "Runs on Side instead of api's account. Other Claude sessions in api don't change.",
    );
    expect(note({ targets: ["api", "web"], everyProject: false }, "", null)).toBe(
      "Runs on Main login in every project instead of each project's own account.",
    );
    expect(note({ targets: [], everyProject: false }, "work", "default")).toBe(
      "Runs on Work instead of your main login.",
    );
  });

  it("explains a removed account", () => {
    expect(note(one, "gone", "work")).toBe("The account picked for this automation was removed, so it runs on Work.");
  });
});
