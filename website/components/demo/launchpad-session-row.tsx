"use client";

import { AgentGlyph } from "./agent-glyph";
import { relativeAgo, type RecentSession } from "./recent-sessions";
import { FOCUS_RING } from "./ui";

// Ports the app's LaunchpadSessionRow: a recent conversation on an empty
// project's launcher; the row resumes it.
export function LaunchpadSessionRow({
  session,
  onResume,
}: {
  session: RecentSession;
  onResume: (session: RecentSession) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onResume(session)}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)] ${FOCUS_RING}`}
    >
      <AgentGlyph agent={session.agent} size={16} />
      <span title={session.title} className="min-w-0 flex-1 truncate text-[13px] text-[#cccccc]">
        {session.title}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">
        {relativeAgo(session.agoMs)}
      </span>
      <span className="shrink-0 rounded-md border border-[rgba(204,204,204,0.18)] px-2 py-0.5 text-[11px] font-medium text-[#a8a8a8] transition-colors group-hover:border-[#8e8e8e] group-hover:text-[#cccccc]">
        Resume
      </span>
    </button>
  );
}
