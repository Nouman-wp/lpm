import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentTask, SeedSession } from "../seed/types";
import type { AgentStatus } from "./api";
import { startAgent, type AgentLaunchOptions } from "./session";

const NOW = 1_800_000_000_000;
const plain = (s: string) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");

const TASK: AgentTask = {
  prompt: "Rotate the JWT signing key",
  steps: [
    { kind: "thinking" },
    { kind: "tool", label: "Read", arg: "internal/auth/jwt.go", result: "122 lines" },
    { kind: "text", text: "Rotating the key with a grace window." },
  ],
};

function agent(launch: Partial<AgentLaunchOptions> = {}) {
  let out = "";
  const statuses: (AgentStatus | null)[] = [];
  const exit = vi.fn();
  const session = startAgent(
    { write: (data) => (out += data), status: (s) => statuses.push(s), exit, cols: () => 80 },
    { kind: "claude", project: "client-portal", cwd: "~/Projects/client-portal", ...launch },
  );
  return { session, statuses, exit, output: () => plain(out), last: () => statuses[statuses.length - 1] };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("an agent session", () => {
  it("reports no status while it waits for a first prompt", () => {
    const a = agent();
    expect(a.statuses).toEqual([null]);
    expect(a.output()).toContain("Claude Code v");
    expect(a.output()).toContain("※ Tip: lpm launched Claude in this project's root");
  });

  it("streams the project's task for a prompt that matches it", () => {
    const a = agent({ task: TASK, prompt: "  rotate the JWT signing KEY " });
    expect(a.last()).toEqual({ value: "Running", turnStart: NOW });
    vi.advanceTimersByTime(650);
    expect(a.output()).not.toContain("Read(internal/auth/jwt.go)");
    vi.advanceTimersByTime(380);
    expect(a.output()).toContain("⏺ Read(internal/auth/jwt.go)");
    expect(a.output()).toContain("⎿  Read 122 lines");
    vi.advanceTimersByTime(260 + 220);
    expect(a.output()).toContain("⏺ Rotating the key with a grace window.");
    expect(a.output()).toMatch(/✻ \w+ for 2s/);
    expect(a.last()).toEqual({ value: "Done", turnStart: NOW, endedAt: NOW + 1510 });
  });

  it("keeps a busy task working, then settles it", () => {
    const a = agent({ task: { ...TASK, keepBusy: true }, prompt: TASK.prompt });
    vi.advanceTimersByTime(20_000);
    expect(a.last()?.value).toBe("Running");
    expect(a.output()).toContain("Bash(make test)");
    vi.advanceTimersByTime(60_000);
    expect(a.output()).toContain("Done — make test is green.");
    expect(a.last()?.value).toBe("Done");
  });

  it("waits on the question a reply ends with, and a yes carries it out", () => {
    const a = agent({ prompt: "fix the failing build" });
    vi.advanceTimersByTime(5000);
    expect(a.output()).toContain("Want me to patch them");
    expect(a.last()).toMatchObject({ value: "Waiting", turnStart: NOW });
    a.session.input("\x1b[200~yes\x1b[201~");
    a.session.input("\r");
    expect(a.last()?.value).toBe("Running");
    vi.advanceTimersByTime(5000);
    expect(a.output()).toContain("All three TODOs in this project are resolved");
    expect(a.last()?.value).toBe("Done");
  });

  it("answers anything but a yes afresh", () => {
    const a = agent({ prompt: "fix the failing build" });
    vi.advanceTimersByTime(5000);
    a.session.input("what does this project do?\r");
    vi.advanceTimersByTime(5000);
    expect(a.output()).toContain("Fresh project — nothing indexed yet");
    expect(a.output()).not.toContain("All three TODOs");
    expect(a.last()?.value).toBe("Done");
  });

  it("reopens a finished session with its turn drawn in full", () => {
    const seed: SeedSession = { kind: "claude", task: TASK, state: "done", ageMs: 52_000 };
    const a = agent({ resume: seed });
    expect(a.statuses).toEqual([{ value: "Done", turnStart: NOW - 52_000, endedAt: NOW }]);
    expect(a.output()).toContain("❯ Rotate the JWT signing key");
    expect(a.output()).toContain("⏺ Rotating the key with a grace window.");
    expect(a.output()).toMatch(/✻ \w+ for 52s/);
  });

  it("reopens a session stopped on a question, which a yes answers", () => {
    const seed: SeedSession = {
      kind: "codex",
      state: "waiting",
      ageMs: 240_000,
      task: {
        prompt: "Upgrade the payments SDK",
        steps: [
          { kind: "tool", label: "Read", arg: "package.json", result: "48 lines" },
          { kind: "text", text: "v5 drops the legacy charge API. Want me to migrate both call sites?" },
        ],
      },
      answer: {
        steps: [
          { kind: "tool", label: "Edit", arg: "src/pay.ts", result: "+12 -9" },
          { kind: "text", text: "Migrated both call sites." },
        ],
      },
    };
    const a = agent({ kind: "codex", resume: seed });
    expect(a.statuses).toEqual([{ value: "Waiting", turnStart: NOW - 240_000 }]);
    expect(a.output()).toContain("Want me to migrate both call sites?");
    a.session.input("go ahead\r");
    vi.advanceTimersByTime(2000);
    expect(a.output()).toContain("• Edited pay.ts (+12 -9)");
    expect(a.output()).toContain("• Migrated both call sites.");
    expect(a.last()?.value).toBe("Done");
  });

  it("queues a prompt sent mid-turn and runs it once the turn lands", () => {
    const a = agent({ prompt: "hello" });
    a.session.input("run the tests\r");
    expect(a.statuses.filter((s) => s?.value === "Running")).toHaveLength(1);
    vi.advanceTimersByTime(1200);
    expect(a.statuses.filter((s) => s?.value === "Running")).toHaveLength(2);
    vi.advanceTimersByTime(3000);
    expect(a.output()).toContain("Bash(make test)");
    expect(a.last()?.value).toBe("Done");
  });

  it("stops a running turn on Ctrl+C and Esc", () => {
    const a = agent({ prompt: "explain this project" });
    vi.advanceTimersByTime(700);
    a.session.input("\x03");
    expect(a.output()).toContain("Interrupted · What should Claude do instead?");
    expect(a.last()).toEqual({ value: "Done", turnStart: NOW, endedAt: NOW + 700 });
    vi.advanceTimersByTime(10_000);
    expect(a.output()).not.toContain("Fresh project");
    expect(a.exit).not.toHaveBeenCalled();

    a.session.input("explain it again\r");
    expect(a.last()?.value).toBe("Running");
    a.session.input("\x1b");
    expect(a.last()?.value).toBe("Done");
  });

  it("exits on a second Ctrl+C at an empty prompt, or on /exit", () => {
    const a = agent();
    a.session.input("draft\x03");
    a.session.input("\x03");
    expect(a.output()).toContain("Press Ctrl-C again to exit");
    vi.advanceTimersByTime(2500);
    a.session.input("\x03");
    expect(a.exit).not.toHaveBeenCalled();
    a.session.input("\x03");
    expect(a.exit).toHaveBeenCalledOnce();
    expect(a.last()).toBeNull();

    const b = agent({ kind: "codex" });
    b.session.input("/exit\r");
    expect(b.exit).toHaveBeenCalledOnce();
    expect(b.output()).toContain("To continue this session, run codex resume");
  });

  it("folds Codex's reads into one Explored block and rules off its answer", () => {
    const a = agent({ kind: "codex", prompt: "what does this project do?" });
    vi.advanceTimersByTime(5000);
    expect(a.output()).toMatch(/• Explored\s+└ Read README\.md\s+Read README\.md\s+List \./);
    expect(a.output()).toMatch(/─ Worked for \ds ─+\s+• Fresh project/);
  });

  it("answers the /model and /effort lpm's model picker sends", () => {
    const a = agent({ model: "fable", effort: "high" });
    expect(a.output()).toContain("Fable 5 with high effort · Claude Max");
    a.session.input("/model opus\r");
    a.session.input("/effort max\r");
    expect(a.output()).toContain("⎿  Set model to Opus 4.8");
    expect(a.output()).toContain("⎿  Set effort level to max for this session");
    expect(a.output()).toContain("· Opus 4.8 ·");
    expect(a.statuses).toEqual([null]);
  });

  it("edits the prompt line and sends what it ends up holding", () => {
    const a = agent();
    a.session.input("helo");
    a.session.input("\x1b[D");
    a.session.input("l\x1b[F!\x7f");
    a.session.input("\r");
    expect(a.output()).toContain("❯ hello");
    expect(a.last()?.value).toBe("Running");
  });

  it("folds a long paste into a placeholder but answers what it holds", () => {
    const a = agent();
    a.session.input("\x1b[200~Context:\rthe build is red\rsince this morning\rplease fix the bug\x1b[201~");
    a.session.input("\r");
    expect(a.output()).toContain("❯ [Pasted text #1 +3 lines]");
    vi.advanceTimersByTime(5000);
    expect(a.output()).toContain("Want me to patch them");
    expect(a.last()?.value).toBe("Waiting");
  });

  it("shows a pasted image path as an image", () => {
    const a = agent();
    a.session.input("\x1b[200~ /tmp/shot.png \x1b[201~");
    expect(a.output()).toContain("[Image #1]");
  });
});
