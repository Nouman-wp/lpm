import { AI_CLI_OPTIONS, type AICLI } from "./types";

// An action's or tab's emoji stays one character, so these four non-emoji
// glyphs stand for the agents: surfaces that can draw the agent's mark do, and
// everything else (older builds, the CLI, plain-text titles) shows the glyph.
export const AGENT_EMOJI: Record<AICLI, string> = {
  claude: "✻",
  codex: "◆",
  gemini: "✦",
  opencode: "▣",
};

export const AGENT_EMOJI_CHOICES = AI_CLI_OPTIONS.map(({ value, label }) => ({
  agent: value,
  label,
  emoji: AGENT_EMOJI[value],
}));

export function agentForEmoji(emoji: string | undefined): AICLI | null {
  const trimmed = emoji?.trim();
  if (!trimmed) return null;
  return AGENT_EMOJI_CHOICES.find((c) => c.emoji === trimmed)?.agent ?? null;
}

export function matchingAgentEmoji(search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return AGENT_EMOJI_CHOICES;
  return AGENT_EMOJI_CHOICES.filter(
    (c) => c.label.toLowerCase().includes(query) || c.agent.includes(query),
  );
}
