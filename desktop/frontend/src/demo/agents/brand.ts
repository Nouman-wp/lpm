import type { AgentKind } from "../seed/types";

export interface Brand {
  name: string;
  // What lpm calls the agent ("lpm launched Claude …").
  short: string;
  version: string;
  model: string;
  effort?: string;
}

export const BRAND: Record<AgentKind, Brand> = {
  claude: { name: "Claude Code", short: "Claude", version: "v2.1.232", model: "fable" },
  codex: { name: "OpenAI Codex", short: "Codex", version: "v0.147.0", model: "gpt-6-astra", effort: "max" },
  gemini: { name: "Gemini CLI", short: "Gemini", version: "v0.42.1", model: "gemini-3.1-pro" },
  opencode: { name: "opencode", short: "OpenCode", version: "v1.4.12", model: "anthropic/fable-5" },
};

// How Claude Code names each model it takes by family alias.
const CLAUDE_MODELS: Record<string, string> = {
  fable: "Fable 5",
  opus: "Opus 4.8",
  sonnet: "Sonnet 4.6",
  haiku: "Haiku 4.5",
};

export const CLAUDE_EFFORTS = ["auto", "low", "medium", "high", "xhigh", "max", "ultracode"];

export function claudeModelName(model: string): string | undefined {
  const family = /(fable|opus|sonnet|haiku)/i.exec(model)?.[1].toLowerCase();
  return family ? CLAUDE_MODELS[family] : undefined;
}

// The model a session starts on, as its CLI prints it: Claude by display name,
// Codex by slug, OpenCode as provider/model.
export function launchModel(kind: AgentKind, model?: string, effort?: string): { model: string; effort?: string } {
  const brand = BRAND[kind];
  if (kind === "claude") return { model: claudeModelName(model ?? brand.model) ?? model!, effort };
  if (kind === "codex") return { model: model ?? brand.model, effort: effort ?? (model ? "medium" : brand.effort) };
  return { model: model ?? brand.model };
}

// Claude Code labels each turn with a whimsical verb, and swaps it for a past
// tense one once the turn lands.
const VERBS: readonly (readonly [string, string])[] = [
  ["Percolating", "Percolated"],
  ["Cogitating", "Cogitated"],
  ["Noodling", "Noodled"],
  ["Simmering", "Simmered"],
  ["Puzzling", "Puzzled"],
  ["Brewing", "Brewed"],
  ["Churning", "Churned"],
  ["Mulling", "Mulled"],
  ["Ruminating", "Ruminated"],
  ["Spelunking", "Spelunked"],
  ["Wrangling", "Wrangled"],
  ["Marinating", "Marinated"],
];

export const workingVerb = (seed: number) => VERBS[seed % VERBS.length][0];

export const settledVerb = (seed: number) => VERBS[(seed + 5) % VERBS.length][1];

export const CLAUDE_STARS = ["✢", "✳", "∗", "✻", "✽", "✻", "∗", "✳"];

export const GEMINI_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const GEMINI_PHRASES = [
  "Reticulating splines",
  "Consulting the digital spirits",
  "Untangling the neural nets",
  "Polishing the algorithms",
  "Warming up the AI hamsters",
  "Counting electrons",
];

export const geminiPhrase = (seed: number) => GEMINI_PHRASES[seed % GEMINI_PHRASES.length];
