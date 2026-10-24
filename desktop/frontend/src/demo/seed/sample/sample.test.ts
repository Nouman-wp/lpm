import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { AgentStep, ReplyContext, SeedFolder, SeedProject } from "../types";
import { parseLaunch } from "../../agents/parse";
import { SAMPLE } from "./index";
import { sampleStats } from "./stats";

const lineCount = (text: string) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split("**/")
    .map((part) => part.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
    .join("(?:.*/)?");
  return new RegExp(`^${body}$`);
}

function stepsOf(p: SeedProject): AgentStep[] {
  return [...p.actions.flatMap((a) => a.task?.steps ?? []), ...(p.session?.task.steps ?? [])];
}

function expectReplyMatchesFiles(reply: ReplyContext, files: Record<string, string>) {
  const lines = (path: string) => {
    expect(files[path], path).toBeDefined();
    return `${lineCount(files[path])} lines`;
  };
  expect(reply.manifestLines).toBe(lines(reply.manifest));
  expect(reply.readmeLines).toBe(lines("README.md"));
  expect(reply.focusLines).toBe(lines(reply.focusFile));
  expect(reply.deployLines).toBe(lines(reply.deployFile));
  const matches = Object.keys(files).filter((path) => globToRegExp(reply.sourceGlob).test(path));
  expect(reply.sourceMatches).toBe(`${matches.length} matches`);
}

const PROJECTS = SAMPLE.projects;
const FOLDERS: SeedFolder[] = SAMPLE.folders;

describe("sample projects", () => {
  it("lists saas-app first", () => {
    expect(PROJECTS[0].name).toBe("saas-app");
    expect(new Set(PROJECTS.map((p) => p.name)).size).toBe(PROJECTS.length);
  });

  describe.each(PROJECTS.map((p) => [p.name, p] as const))("%s", (_, p) => {
    it("names each service, action and port once", () => {
      const ports = p.services.map((s) => s.port).filter(Boolean);
      expect(new Set(p.services.map((s) => s.name)).size).toBe(p.services.length);
      expect(new Set(p.actions.map((a) => a.name)).size).toBe(p.actions.length);
      expect(new Set(ports).size).toBe(ports.length);
    });

    it("plays logs in order", () => {
      for (const lines of [...p.services.map((s) => s.log), ...p.actions.map((a) => a.output ?? [])]) {
        const at = lines.map((l) => l.at);
        expect(at).toEqual([...at].sort((a, b) => a - b));
      }
      for (const s of p.services) if (s.loop) expect(s.loop.everyMs).toBeGreaterThan(0);
    });

    it("starts only services it declares", () => {
      const names = new Set(p.services.map((s) => s.name));
      for (const profile of p.profiles) {
        for (const service of profile.services) expect(names, `${profile.name}: ${service}`).toContain(service);
      }
    });

    it("keeps the Review tab in step with the tree", () => {
      expect(p.git.changes.length).toBeGreaterThan(0);
      for (const c of p.git.changes) {
        if (c.status === "deleted") {
          expect(p.files[c.path]).toBeUndefined();
          continue;
        }
        expect(p.files[c.path], c.path).toBe(c.modified);
        if (c.status === "added") expect(c.original).toBe("");
        else expect(c.original, c.path).not.toBe(c.modified);
      }
    });

    it("writes its .lpm.yml from what it declares", () => {
      const config = parse(p.files[".lpm.yml"]);
      expect(Object.keys(config.services)).toEqual(p.services.map((s) => s.name));
      for (const s of p.services) {
        const entry = config.services[s.name];
        expect(typeof entry === "string" ? entry : entry.cmd).toBe(s.cmd);
        expect(typeof entry === "string" ? undefined : entry.port).toBe(s.port);
      }
      expect(Object.keys(config.actions)).toEqual(p.actions.map((a) => a.name));
      p.actions.forEach((a, i) => {
        const entry = config.actions[a.name];
        expect(entry.cmd).toBe(a.cmd);
        expect(entry.label).toBe(a.label);
        expect(entry.emoji).toBe(a.emoji);
        expect(entry.color).toBe(a.color);
        expect(entry.type ?? "").toBe(a.type);
        expect(entry.display ?? "").toBe(a.display);
        expect(entry.confirm ?? false).toBe(a.confirm ?? false);
        expect(entry.position).toBe(i + 1);
      });
      expect(config.profiles).toEqual(Object.fromEntries(p.profiles.map((pr) => [pr.name, pr.services])));
    });

    it("ages every branch and session into the past", () => {
      expect(p.git.branches.map((b) => b.name)).toContain(p.git.branch);
      for (const b of p.git.branches) expect(b.ageMs).toBeGreaterThan(0);
      if (p.session) expect(p.session.ageMs).toBeGreaterThan(0);
    });

    it("gives every agent task something to say", () => {
      for (const a of p.actions) {
        if (a.type === "terminal") expect(parseLaunch(a.cmd)).not.toBeNull();
        if (a.task) {
          expect(parseLaunch(a.cmd)).not.toBeNull();
          expect(a.task.prompt).not.toBe("");
          expect(a.task.steps.length).toBeGreaterThan(0);
        }
        if (a.type === "") expect(a.output?.length).toBeGreaterThan(0);
      }
      if (p.session) {
        expect(p.actions.some((a) => parseLaunch(a.cmd)?.kind === p.session!.kind)).toBe(true);
        expect(p.session.task.steps.length).toBeGreaterThan(0);
        if (p.session.state === "waiting") expect(p.session.answer?.steps.length).toBeGreaterThan(0);
      }
    });

    it("quotes the files its agents read and write", () => {
      for (const step of stepsOf(p)) {
        if (step.kind !== "tool") continue;
        const change = p.git.changes.find((c) => c.path === step.arg);
        if (step.label === "Read") {
          expect(p.files[step.arg], step.arg).toBeDefined();
          const counts = [p.files[step.arg], change?.original].filter(Boolean).map((t) => `${lineCount(t!)} lines`);
          expect(counts, step.arg).toContain(step.result);
        }
        if (step.label === "Write") expect(change?.status, step.arg).toBe("added");
        if (step.label === "Edit") expect(change?.status, step.arg).toBe("modified");
      }
    });

    it("tells its agents what its files say", () => {
      expectReplyMatchesFiles(p.reply, p.files);
    });
  });
});

describe("sample folders", () => {
  it("are new projects, apart from auth-service before lpm has a config for it", () => {
    const projects = new Set(PROJECTS.map((p) => p.name));
    const repeats = FOLDERS.filter((f) => projects.has(f.name));
    expect(repeats.map((f) => f.name)).toEqual(["auth-service"]);
    expect(repeats[0].files[".lpm.yml"]).toBeUndefined();
    expect(FOLDERS[0].name).toBe("client-portal");
  });

  it.each(FOLDERS.map((f) => [f.name, f] as const))("%s detects what its files hold", (_, f) => {
    expect(f.services.length).toBeGreaterThan(0);
    expect(Object.keys(f.files)).toContain("README.md");
    if (f.reply) expectReplyMatchesFiles(f.reply, f.files);
    if (f.git) expect(f.git.branches.map((b) => b.name)).toContain(f.git.branch);
  });
});

describe("sample automations", () => {
  const names = new Set(PROJECTS.map((p) => p.name));

  it("run in sample projects", () => {
    for (const job of SAMPLE.jobs as { project?: string; targets: string[] }[]) {
      if (job.project) expect(names).toContain(job.project);
      for (const target of job.targets) expect(names).toContain(target);
    }
  });

  it("count their unread runs from their history", () => {
    for (const job of SAMPLE.jobs as { id: string; unread: number; lastMessage: string; lastRunAt: number }[]) {
      const runs = SAMPLE.jobHistory?.[job.id] as { at: number; unread?: boolean; output: string }[];
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.filter((r) => r.unread).length).toBe(job.unread);
      expect(runs[runs.length - 1].output).toBe(job.lastMessage);
      expect(job.lastRunAt * 1000).toBeLessThan(Date.now());
    }
  });
});

describe("sample stats", () => {
  type Stats = ReturnType<typeof sampleStats>;
  const total = (rows: Stats["providers"]) => rows.reduce((n, r) => n + r.tokens.totalTokens, 0);

  it.each([1, 7, 30, 0])("adds up over %i days", (days) => {
    const stats = sampleStats(days);
    expect(stats.days).toBe(days);
    if (days) expect(stats.daily).toHaveLength(days);
    expect(total(stats.providers)).toBe(stats.totals.totalTokens);
    expect(total(stats.projects)).toBe(stats.totals.totalTokens);
    expect(total(stats.models)).toBe(stats.totals.totalTokens);
    expect(stats.daily.reduce((n, d) => n + d.totalTokens, 0)).toBe(stats.totals.totalTokens);
    for (const day of stats.daily) {
      const rows = (day.projects ?? []).flatMap((row) => row.models);
      expect(rows.reduce((n, m) => n + m.tokens.totalTokens, 0)).toBe(day.totalTokens);
    }
    expect(stats.previous === undefined).toBe(days !== 7 && days !== 30);
  });

  it("leaves omitted projects out", () => {
    const stats = sampleStats(30, ["auth-service"]);
    expect(stats.projects.map((p) => p.key)).not.toContain("auth-service");
    expect(stats.daily.flatMap((d) => d.projects ?? []).map((r) => r.project)).not.toContain(
      "auth-service",
    );
    expect(stats.recentSessions.map((s) => s.project)).not.toContain("auth-service");
    expect(total(stats.projects)).toBe(stats.totals.totalTokens);
  });
});
