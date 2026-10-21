import type { AgentKind } from "../seed/types";
import { BRAND, CLAUDE_EFFORTS, claudeModelName } from "./brand";

export type SlashCommand =
  | { kind: "exit" }
  | { kind: "clear" }
  // An answer printed under the command, and what it switched the session to
  // (null effort: back to the model's own).
  | { kind: "notice"; text: string; model?: string; effort?: string | null };

// The slash commands the demo CLIs answer themselves — among them Claude Code's
// /model and /effort, which lpm's model picker sends and then reads back off the
// screen. Anything else goes to the model as a prompt.
export function slashCommand(agent: AgentKind, command: string): SlashCommand | null {
  const [name, arg = ""] = command.trim().split(/\s+/);
  if (/^\/?(exit|quit)$/i.test(name) && !arg) return { kind: "exit" };
  if (name === "/clear" || (name === "/new" && agent === "codex")) return { kind: "clear" };
  if (name === "/help") {
    const extra = agent === "claude" ? " · /model · /effort" : "";
    return { kind: "notice", text: `${BRAND[agent].name} in the lpm demo · /clear${extra} · /exit` };
  }
  if (agent !== "claude") return null;
  if (name === "/model") {
    const model = claudeModelName(arg);
    return model
      ? { kind: "notice", text: `Set model to ${model}`, model }
      : { kind: "notice", text: "Usage: /model <fable|opus|sonnet|haiku>" };
  }
  if (name === "/effort") {
    const level = arg.toLowerCase();
    return CLAUDE_EFFORTS.includes(level)
      ? { kind: "notice", text: `Set effort level to ${level} for this session`, effort: level === "auto" ? null : level }
      : { kind: "notice", text: `Usage: /effort <${CLAUDE_EFFORTS.join("|")}>` };
  }
  return null;
}

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif)$/i;

// A pasted image path as the placeholder the CLIs show for an image, which is
// also what lpm's composer waits to see before it sends the rest; null for any
// other paste.
export function imagePaste(text: string, n: number): string | null {
  const path = text.trim().replace(/^(['"])(.*)\1$/s, "$2").replace(/\\(.)/g, "$1");
  if (text.includes("\n") || !IMAGE.test(path)) return null;
  return text.replace(text.trim(), `[Image #${n}]`);
}

// A long paste folded into one placeholder, as Claude Code and Codex fold it, so
// the prompt stays a few rows tall; the text behind it is what gets sent. Null
// for a paste short enough to show.
export function pasteLabel(agent: AgentKind, text: string, n: number): string | null {
  const lines = text.split("\n").length;
  if (lines <= 3 && text.length <= 800) return null;
  return agent === "codex" ? `[Pasted Content ${text.length} chars]` : `[Pasted text #${n} +${lines - 1} lines]`;
}
