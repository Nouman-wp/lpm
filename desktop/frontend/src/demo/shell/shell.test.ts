import { describe, expect, it, vi } from "vitest";
import type { AgentSession } from "../agents/api";
import { createShell, type ShellContext } from "./shell";

const plain = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

function shell(overrides: Partial<ShellContext> = {}) {
  let out = "";
  const exit = vi.fn();
  const ctx: ShellContext = {
    cwd: "~/Projects/saas-app",
    entries: () => [
      { name: "src", isDir: true },
      { name: "package.json", isDir: false },
    ],
    services: () => [],
    git: () => ({ branch: "feat/billing", changes: [{ path: "src/billing.ts", status: "modified" }] }),
    launch: () => null,
    ran: vi.fn(),
    serviceLog: () => [{ text: "ready", at: 10 }],
    ...overrides,
  };
  const sh = createShell({ write: (data) => (out += data), exit }, ctx);
  return { sh, ctx, exit, output: () => plain(out) };
}

describe("demo shell", () => {
  it("edits the line and runs it on Enter", () => {
    const { sh, output, ctx } = shell();
    sh.input("lsx\x7f\r");
    expect(output()).toContain("lsx\b \b\r\nsrc  package.json\r\n");
    expect(ctx.ran).toHaveBeenCalledWith("ls");
  });

  it("reports the project's working tree", () => {
    const { sh, output } = shell();
    sh.input("git status\r");
    expect(output()).toContain("On branch feat/billing");
    expect(output()).toContain("src/billing.ts");
  });

  it("points an unknown command at what the demo can run", () => {
    const { sh, output } = shell();
    sh.input("rm -rf /\r");
    expect(output()).toContain("command not found: rm");
  });

  it("hands the terminal to an agent until it exits", () => {
    const agent: AgentSession = { input: vi.fn(), dispose: vi.fn() };
    let exitAgent = () => {};
    const { sh, output } = shell({
      launch: (input, exit) => {
        exitAgent = exit;
        return input.startsWith("claude") ? agent : null;
      },
    });
    sh.input("claude\rhello");
    expect(agent.input).toHaveBeenCalledWith("hello");
    exitAgent();
    sh.input("pwd\r");
    expect(output()).toContain("/Users/you/Projects/saas-app");
  });

  it("runs a dev server until Ctrl+C", () => {
    vi.useFakeTimers();
    const { sh, output } = shell();
    sh.input("npm run dev\r");
    vi.advanceTimersByTime(20);
    expect(output()).toContain("ready");
    sh.input("\x03");
    expect(output()).toMatch(/\^C\r\n.*saas-app/);
    vi.useRealTimers();
  });
});
