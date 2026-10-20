import { agentForEmoji } from "../agentEmoji";
import { AgentGlyph } from "./terminal/AgentGlyph";

/** An action's or tab's emoji on its own, drawn as the agent's mark when it names one. */
export function EmojiMark({ emoji, size = 14 }: { emoji: string; size?: number }) {
  const agent = agentForEmoji(emoji);
  return agent ? <AgentGlyph agent={agent} size={size} /> : <>{emoji}</>;
}
