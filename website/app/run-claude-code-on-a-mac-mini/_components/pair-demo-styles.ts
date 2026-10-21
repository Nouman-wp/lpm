export const MUTED = "text-[#8a8a8a]";
export const PRIMARY = "text-[#ededed]";
export const BORDER = "border-[#2e2e2e]";
export const GROUP_HEADER = `mb-2 text-[10px] font-medium uppercase tracking-[0.15em] ${MUTED}`;
export const GROUP = `overflow-hidden rounded-xl border ${BORDER}`;
export const TILE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-500";

export const LIVE_TILE = {
  backgroundColor: "rgba(74, 222, 128, 0.15)",
  color: "#4ade80",
};
export const IDLE_TILE = {
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "#8a8a8a",
};

export const SAS = "482 913";
export const LAPTOP_NAME = "MacBook Air";
export const HOST_NAME = "Mac mini";
export const PROJECT = "shop-api";

export const AGENTS = [
  {
    glyph: "✻",
    color: "#d97757",
    name: "Claude Code",
    task: "Fix the flaky checkout test",
    elapsed: "12m",
  },
  {
    glyph: "◆",
    color: "#22d3ee",
    name: "Codex",
    task: "Add pagination to /orders",
    elapsed: "4m",
  },
];
