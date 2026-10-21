import type { AgentKind } from "./agent-script";
import { AgentGlyph } from "./agent-glyph";

// The app keeps an action's or tab's emoji one character, so these glyphs
// stand for the agents and are drawn as the agent's mark wherever it shows.
const AGENT_EMOJI: Record<string, AgentKind> = {
  "✻": "claude",
  "◆": "codex",
};

/** An action's or tab's emoji on its own, drawn as the agent's mark when it names one. */
export function EmojiMark({ emoji, size = 14 }: { emoji: string; size?: number }) {
  const agent = AGENT_EMOJI[emoji.trim()];
  return agent ? <AgentGlyph agent={agent} size={size} /> : <>{emoji}</>;
}
