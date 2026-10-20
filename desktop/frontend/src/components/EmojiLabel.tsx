import { agentForEmoji } from "../agentEmoji";
import { withEmoji } from "../withEmoji";
import { AgentGlyph } from "./terminal/AgentGlyph";

/**
 * withEmoji for display: the same "emoji label" text, except an agent's emoji
 * is drawn as its mark. Inline, so a truncating parent still ellipsizes it.
 */
export function EmojiLabel({
  emoji,
  label,
  size = "1.15em",
}: {
  emoji: string | undefined;
  label: string;
  size?: number | string;
}) {
  const agent = agentForEmoji(emoji);
  if (!agent) return <>{withEmoji(emoji, label)}</>;
  return (
    <span>
      <span className="mr-[0.35em] inline-flex align-[-0.2em]">
        <AgentGlyph agent={agent} size={size} />
      </span>
      {label}
    </span>
  );
}
