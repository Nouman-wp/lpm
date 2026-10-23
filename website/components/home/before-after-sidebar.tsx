import { MoreHorizontal, Plus } from "lucide-react";
import { TerminalGlyph } from "@/components/home/terminal-glyph";
import { ReplicaProjectRow, type Row } from "./before-after-project-row";

export const ROWS: Row[] = [
  {
    name: "auth-service",
    running: true,
    selected: true,
    agent: { name: "claude", state: "waiting", elapsed: "4m", onScreen: true },
  },
  {
    name: "saas-app",
    running: true,
    agent: { name: "codex", state: "working", elapsed: "41s" },
  },
  {
    name: "docs-site",
    running: true,
    agent: { name: "claude", state: "done", elapsed: "52s" },
  },
  { name: "ml-pipeline", running: true },
];

export const PROJECT_COUNT = ROWS.length;
const NEEDS_YOU = ROWS.filter((r) => r.agent?.state === "waiting").length;

const FOOTER_ROW =
  "flex items-center gap-[0.55em] rounded-[0.45em] px-[0.7em] py-[0.4em] text-[1.05em] text-[#b3b3b3]";
const FOOTER_ICON = "flex h-[0.9em] w-[0.9em] shrink-0 items-center [&>svg]:h-full [&>svg]:w-full";

export function ReplicaSidebar() {
  return (
    <aside className="flex w-[11.4em] shrink-0 flex-col border-r border-[#2e2e2e] bg-[#1e1e1e]">
      <div className="flex h-[2.6em] shrink-0 items-center gap-[0.55em] px-[0.9em] pt-[0.3em]">
        <span className="h-[0.7em] w-[0.7em] rounded-full bg-[#ff5f57]" />
        <span className="h-[0.7em] w-[0.7em] rounded-full bg-[#febc2e]" />
        <span className="h-[0.7em] w-[0.7em] rounded-full bg-[#28c840]" />
        <svg
          viewBox="0 0 22 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto h-[0.85em] w-[1.1em] text-[#919191]"
        >
          <rect x="1" y="1" width="20" height="14" rx="2.5" />
          <line x1="8" y1="1" x2="8" y2="15" />
        </svg>
      </div>
      <div className="flex items-center justify-between px-[1em] pb-[0.4em] pt-[0.5em] text-[0.85em] font-medium uppercase tracking-wider text-[#919191]">
        Projects
        <Plus className="h-[1.1em] w-[1.1em]" strokeWidth={1.5} />
      </div>
      <nav className="flex flex-col gap-[0.15em] px-[0.5em]">
        {ROWS.map((row) => (
          <ReplicaProjectRow key={row.name} row={row} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col p-[0.5em]">
        <div className={FOOTER_ROW}>
          <span className={FOOTER_ICON}>
            <TerminalGlyph />
          </span>
          Terminals
        </div>
        <div className={FOOTER_ROW}>
          <span className={FOOTER_ICON}>
            <MoreHorizontal strokeWidth={1.5} />
          </span>
          More
          <span className="ml-auto flex items-center gap-[0.35em] text-[0.75em] font-medium tabular-nums text-[#fbbf24]">
            <span className="h-[0.55em] w-[0.55em] rounded-full bg-[#fbbf24]" />
            {NEEDS_YOU}
          </span>
        </div>
      </div>
    </aside>
  );
}
