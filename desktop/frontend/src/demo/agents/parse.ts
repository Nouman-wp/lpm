import { commandName } from "../../path";
import { isAICLI } from "../../types";
import type { AgentKind } from "../seed/types";

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

export interface ParsedLaunch {
  kind: AgentKind;
  prompt: string;
  // The id lpm pre-mints for a new Claude conversation (`--session-id`).
  sessionId?: string;
  // The conversation a launch reopens (`claude --resume <id>`, `codex resume <id>`).
  resumeId?: string;
  // `--model` / `-m`, and Claude's `--effort` or Codex's `model_reasoning_effort`.
  model?: string;
  effort?: string;
}

interface Token {
  text: string;
  quoted: boolean;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const re = /'((?:[^']|'\\'')*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g;
  for (const m of input.matchAll(re)) {
    if (m[3] !== undefined) tokens.push({ text: m[3], quoted: false });
    else if (m[1] !== undefined) tokens.push({ text: m[1].replace(/'\\''/g, "'"), quoted: true });
    else tokens.push({ text: m[2].replace(/\\(.)/g, "$1"), quoted: true });
  }
  return tokens;
}

// Flags that take a value, and ones that never do, per CLI. An unknown flag
// takes the next bare word, the way most of them are spelled.
const FLAGS: Record<AgentKind, { value: string[]; bool: string[] }> = {
  claude: {
    value: [
      "--model", "--effort", "--session-id", "--resume", "-r", "--permission-mode", "--settings",
      "--add-dir", "--allowedTools", "--allowed-tools", "--disallowedTools", "--disallowed-tools",
      "--append-system-prompt", "--system-prompt", "--mcp-config", "--agents", "--agent",
      "--output-format", "--input-format", "--fallback-model", "--max-turns", "--setting-sources",
    ],
    bool: [
      "--dangerously-skip-permissions", "--allow-dangerously-skip-permissions", "--continue", "-c",
      "--fork-session", "--verbose", "--debug", "-d", "--ide", "--print", "-p", "--strict-mcp-config",
    ],
  },
  codex: {
    value: [
      "-c", "--config", "-m", "--model", "-p", "--profile", "-s", "--sandbox", "-a",
      "--ask-for-approval", "-C", "--cd", "-i", "--image", "--add-dir", "--enable", "--disable",
    ],
    bool: ["--full-auto", "--dangerously-bypass-approvals-and-sandbox", "--yolo", "--search", "--oss", "--last", "--all"],
  },
  gemini: {
    value: ["-m", "--model", "-r", "--resume", "--approval-mode", "-e", "--extensions", "--include-directories", "-i", "--prompt-interactive"],
    bool: ["-y", "--yolo", "-d", "--debug", "-s", "--sandbox", "--checkpointing", "--screen-reader"],
  },
  opencode: {
    value: ["-m", "--model", "-s", "--session", "--prompt", "--agent", "--port", "--hostname", "--log-level"],
    bool: ["-c", "--continue", "--print-logs"],
  },
};

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

function applyFlag(out: ParsedLaunch, words: string[], name: string, value: string | undefined) {
  if (value === undefined) return;
  if (name === "--model" || name === "-m") out.model = value;
  else if (out.kind === "claude" && name === "--effort") out.effort = value;
  else if (out.kind === "claude" && name === "--session-id") out.sessionId = value;
  else if ((out.kind === "claude" || out.kind === "gemini") && (name === "--resume" || name === "-r")) out.resumeId = value;
  else if (out.kind === "opencode" && (name === "--session" || name === "-s")) out.resumeId = value;
  else if (name === "--prompt" || name === "-i" || name === "--prompt-interactive") words.push(value);
  else if (out.kind === "codex" && (name === "-c" || name === "--config")) {
    const [key, setting = ""] = value.split(/=(.*)/s);
    if (key === "model_reasoning_effort") out.effort = unquote(setting);
    else if (key === "model") out.model = unquote(setting);
  }
}

// `claude --session-id <uuid> --model opus 'fix the bug'` as lpm writes it: the
// agent, the prompt it was started with once its flags and their values are set
// aside, and the conversation it opens or reopens. Leading `KEY=value`
// assignments and a path to the binary are part of the launch, not the agent.
export function parseLaunch(input: string): ParsedLaunch | null {
  const tokens = tokenize(input.trim());
  let at = 0;
  while (at < tokens.length && !tokens[at].quoted && ENV_ASSIGNMENT.test(tokens[at].text)) at++;
  const kind = tokens[at] && commandName(tokens[at].text);
  if (!isAICLI(kind)) return null;

  const out: ParsedLaunch = { kind, prompt: "" };
  const words: string[] = [];
  const flags = FLAGS[kind];
  const args = tokens.slice(at + 1);
  const subcommand = kind === "codex" || kind === "claude";
  let resumeNext = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.quoted || !arg.text.startsWith("-") || arg.text === "-") {
      if (resumeNext) {
        out.resumeId = arg.text;
        resumeNext = false;
      } else if (subcommand && !arg.quoted && arg.text === "resume" && words.length === 0 && !out.resumeId) {
        resumeNext = true;
      } else words.push(arg.text);
      continue;
    }
    if (arg.text === "--") {
      words.push(...args.slice(i + 1).map((a) => a.text));
      break;
    }
    const eq = arg.text.indexOf("=");
    const name = eq > 0 ? arg.text.slice(0, eq) : arg.text;
    let value: string | undefined;
    if (eq > 0) value = arg.text.slice(eq + 1);
    else if (flags.bool.includes(name)) value = undefined;
    else {
      const next = args[i + 1];
      const takes = flags.value.includes(name) || (next && !next.quoted && !next.text.startsWith("-"));
      if (takes && next) {
        value = next.text;
        i++;
      }
    }
    applyFlag(out, words, name, value);
  }
  if (resumeNext && kind === "claude") words.unshift("resume");
  out.prompt = words.join(" ");
  return out;
}
