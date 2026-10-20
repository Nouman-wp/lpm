import { matchingAgentEmoji } from "../agentEmoji";
import { EmojiButton } from "./EmojiButton";
import { AgentGlyph } from "./terminal/AgentGlyph";

export function EmojiAgentRow({
  search,
  columns,
  onSelect,
}: {
  search: string;
  columns: number;
  onSelect: (emoji: string) => void;
}) {
  const choices = matchingAgentEmoji(search);
  if (choices.length === 0) return null;
  return (
    <div className="border-b border-[var(--border)]">
      <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        Agents
      </div>
      <div
        className="grid gap-0.5 px-1.5 pb-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {choices.map((c) => (
          <EmojiButton
            key={c.agent}
            title={c.label}
            aria-label={c.label}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onSelect(c.emoji)}
          >
            <AgentGlyph agent={c.agent} size={22} />
          </EmojiButton>
        ))}
      </div>
    </div>
  );
}
