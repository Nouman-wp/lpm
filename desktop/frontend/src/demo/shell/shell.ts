import type { AgentSession } from "../agents/api";
import type { SeedLine, SeedService } from "../seed/types";
import { BLUE, BOLD, CLEAR, CYAN, GRAY, GREEN, RED, RESET, lineText, lines } from "../ansi";

export interface ShellIO {
  write: (data: string) => void;
  exit: (code: number) => void;
}

export interface ShellContext {
  cwd: string;
  entries: () => { name: string; isDir: boolean }[];
  services: () => SeedService[];
  git: () => { branch: string; changes: { path: string; status: string }[] } | null;
  // Starts the agent CLI an input line names, or returns null for anything else.
  launch: (input: string, exit: () => void) => AgentSession | null;
  ran: (input: string) => void;
  serviceLog: (svc: SeedService | null) => SeedLine[];
}

export interface Shell {
  start: () => void;
  input: (data: string) => void;
  resize: () => void;
  stop: () => void;
}

const HINT = `${GRAY}This is the lpm demo terminal. Try claude, codex, ls, git status or npm run dev.${RESET}`;
const DEV_CMD = /^(npm run dev|npm start|pnpm dev|yarn dev|bun dev)$/;

function gitStatus(git: ReturnType<ShellContext["git"]>): string {
  if (!git) return lines("fatal: not a git repository (or any of the parent directories): .git");
  if (!git.changes.length) return lines(`On branch ${git.branch}`, "nothing to commit, working tree clean");
  return lines(
    `On branch ${git.branch}`,
    "Changes not staged for commit:",
    `  ${GRAY}(use "git add <file>..." to update what will be committed)${RESET}`,
    ...git.changes.map((c) => `\t${RED}${(c.status + ":").padEnd(12)}${c.path}${RESET}`),
    "",
  );
}

export function createShell(io: ShellIO, ctx: ShellContext): Shell {
  const dir = ctx.cwd.split("/").pop() || ctx.cwd;
  const promptText = `${GREEN}${BOLD}➜${RESET}  ${CYAN}${BOLD}${dir}${RESET} `;
  let line = "";
  let agent: AgentSession | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let foreground = false;

  const prompt = () => io.write(promptText);
  // Read through a call: a line run mid-loop can hand the terminal to an agent.
  const activeAgent = () => agent;

  function cancel() {
    timers.forEach(clearTimeout);
    timers = [];
    foreground = false;
  }

  function runService(input: string) {
    const svc = ctx.services().find((s) => s.cmd === input) ?? null;
    foreground = true;
    for (const l of ctx.serviceLog(svc)) timers.push(setTimeout(() => io.write(`${lineText(l)}\r\n`), l.at));
  }

  function run(input: string) {
    if (input) ctx.ran(input);
    const [cmd = "", ...rest] = input.split(/\s+/);
    const launched = input ? ctx.launch(input, () => {
      agent = null;
      prompt();
    }) : null;
    if (launched) {
      agent = launched;
      return;
    }
    if (DEV_CMD.test(input) || ctx.services().some((s) => s.cmd === input)) return runService(input);
    switch (cmd) {
      case "":
      case "cd":
        break;
      case "clear":
        io.write(CLEAR);
        break;
      case "ls":
        io.write(lines(ctx.entries().map((e) => (e.isDir ? `${BLUE}${BOLD}${e.name}${RESET}` : e.name)).join("  ")));
        break;
      case "pwd":
        io.write(lines(ctx.cwd.replace(/^~/, "/Users/you")));
        break;
      case "echo":
        io.write(lines(rest.join(" ")));
        break;
      case "whoami":
        io.write(lines("you"));
        break;
      case "date":
        io.write(lines(new Date().toString()));
        break;
      case "git":
        io.write(rest[0] === "status" ? gitStatus(ctx.git()) : rest[0] === "branch" ? lines(`* ${ctx.git()?.branch ?? "main"}`) : lines(HINT));
        break;
      case "help":
        io.write(lines(HINT));
        break;
      case "exit":
        return io.exit(0);
      default:
        io.write(lines(`zsh: command not found: ${cmd}`, HINT));
    }
    prompt();
  }

  function input(data: string) {
    if (agent) return agent.input(data);
    const text = data.replace(/\x1b\[20[01]~/g, "");
    for (let i = 0; i < text.length; i++) {
      const handedOff = activeAgent();
      if (handedOff) return handedOff.input(text.slice(i));
      const ch = text[i];
      if (ch === "\x03") {
        cancel();
        line = "";
        io.write("^C\r\n");
        prompt();
      } else if (foreground) {
        continue;
      } else if (ch === "\x1b") {
        const seq = text.slice(i).match(/^\x1b(\[[0-9;?]*[ -/]*[@-~]|O.|.)/);
        i += (seq?.[0].length ?? 1) - 1;
      } else if (ch === "\r" || ch === "\n") {
        const submitted = line.trim();
        line = "";
        io.write("\r\n");
        run(submitted);
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else if (ch === "\x7f" || ch === "\b") {
        if (line) {
          line = line.slice(0, -1);
          io.write("\b \b");
        }
      } else if (ch === "\x04") {
        if (!line) io.exit(0);
      } else if (ch >= " ") {
        line += ch;
        io.write(ch);
      }
    }
  }

  return {
    start: prompt,
    input,
    resize: () => agent?.resize?.(),
    stop: () => {
      cancel();
      agent?.dispose();
      agent = null;
    },
  };
}
