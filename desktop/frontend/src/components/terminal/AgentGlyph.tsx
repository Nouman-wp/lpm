import type { AICLI } from "../../types";

const GLYPHS: Record<AICLI, { mark: string; color: string }> = {
  claude: { mark: "✻", color: "var(--accent-claude)" },
  codex: { mark: "◈", color: "var(--accent-emerald)" },
  gemini: { mark: "✦", color: "var(--accent-blue)" },
  opencode: { mark: "▣", color: "var(--accent-slate)" },
};

export function AgentGlyph({ agent }: { agent: AICLI }) {
  const { mark, color } = GLYPHS[agent];
  return (
    <span
      aria-hidden
      className="inline-grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] leading-none text-white"
      style={{ backgroundColor: color }}
    >
      {mark}
    </span>
  );
}
