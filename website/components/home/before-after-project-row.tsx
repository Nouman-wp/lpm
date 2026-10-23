import { Bell, Check, ChevronRight } from "lucide-react";

export type AgentState = "waiting" | "working" | "done";
/** `onScreen` marks the task whose terminal the pane is showing. */
export type Agent = { name: string; state: AgentState; elapsed: string; onScreen?: boolean };
export type Row = { name: string; running: boolean; selected?: boolean; agent?: Agent };

// The agent states the app paints, in its own colours: amber pulsing while a
// turn waits on you, a gradient shimmer while it works, blue once it lands.
const AGENT_TONE: Record<AgentState, string> = {
  waiting: "sidebar-waiting",
  working: "sidebar-shimmer",
  done: "text-[#60a5fa]",
};

const MARK_SLOT = "flex h-[0.9em] w-[0.9em] shrink-0 items-center justify-center";

export function ReplicaProjectRow({ row }: { row: Row }) {
  const { agent } = row;
  return (
    <div>
      <div
        className={`flex items-center gap-[0.7em] rounded-[0.45em] px-[0.7em] py-[0.4em] text-[1.05em] ${
          row.selected ? "bg-[#333333] text-[#e5e5e5]" : "text-[#b3b3b3]"
        }`}
      >
        <span
          className={
            row.running
              ? "h-[0.6em] w-[0.6em] shrink-0 rounded-full bg-[#4ade80]"
              : "h-[0.6em] w-[0.6em] shrink-0 rounded-full border border-[#919191] bg-[#1a1a1a]"
          }
        />
        {/* With its agents listed underneath, the app leaves waiting and working
            to those rows; only a landed turn tints the project name. The
            chevron sits tighter to the name than the row's gap, so the narrow
            replica keeps the whole name. */}
        <span
          className={`min-w-0 truncate ${agent ? "-mr-[0.35em]" : ""} ${
            agent?.state === "done" ? "text-[#60a5fa]" : ""
          }`}
        >
          {row.name}
        </span>
        {agent && (
          <ChevronRight
            className="-mr-[0.25em] ml-auto h-[0.85em] w-[0.85em] shrink-0 rotate-90 text-[#919191]"
            strokeWidth={1.5}
          />
        )}
      </div>
      {agent && (
        // One line per agent under the project it runs in: the tab it lives in,
        // coloured by what it is doing, a mark, and how long it has taken.
        <div
          data-agent-state={agent.state}
          className={`ba-state flex items-center gap-[0.5em] rounded-[0.45em] py-[0.22em] pl-[1.15em] pr-[0.6em] text-[0.95em] ${
            agent.onScreen ? "bg-[#e5e5e5]/8 text-[#e5e5e5]" : "text-[#919191]"
          }`}
        >
          <span className={MARK_SLOT} />
          <span className={`min-w-0 flex-1 truncate ${AGENT_TONE[agent.state]}`}>
            {agent.name}
          </span>
          <span className={`${MARK_SLOT} ${agent.state === "working" ? "" : AGENT_TONE[agent.state]}`}>
            {agent.state === "waiting" ? (
              <Bell className="h-full w-full" strokeWidth={2} />
            ) : agent.state === "done" ? (
              <Check className="h-[0.78em] w-[0.78em]" strokeWidth={2} />
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums">{agent.elapsed}</span>
        </div>
      )}
    </div>
  );
}
