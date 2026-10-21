"use client";

import { useState } from "react";
import { DEMO_EPOCH } from "./agent-terminal";
import { LaunchpadPrompt } from "./launchpad-prompt";
import { LaunchpadSessionRow } from "./launchpad-session-row";
import {
  launchedAgent,
  launchpadAgents,
  launchpadCommand,
  loadLaunchpadPick,
  saveLaunchpadPick,
} from "./launchpad-options";
import { CLAUDE_ACTION, CODEX_ACTION, type DemoAction, type DemoProject } from "./projects";
import { RECENT_SESSIONS, type RecentSession } from "./recent-sessions";

// Ports the app's EmptyTerminalState: a project with no terminals open gets a
// launcher for what's next and the last few conversations.
export function ProjectLaunchpad({
  project,
  onOpenTerminal,
  onOpenAgent,
}: {
  project: DemoProject;
  onOpenTerminal: (command?: string) => void;
  onOpenAgent: (action: DemoAction) => void;
}) {
  const agents = launchpadAgents(project.actions);
  const [picked, setPicked] = useState(loadLaunchpadPick);
  const [value, setValue] = useState("");
  const option = agents.find((a) => a.name === picked) ?? null;
  const recent = RECENT_SESSIONS[project.name] ?? [];

  const start = () => {
    const text = value.trim();
    saveLaunchpadPick(option?.name ?? "terminal");
    const command = option ? launchpadCommand(text) : text;
    if (!option || command !== null) return onOpenTerminal(command || undefined);
    onOpenAgent(text ? launchedAgent(option, { firstPrompt: text }) : option);
  };

  const resume = (session: RecentSession) => {
    const action =
      agents.find((a) => a.agent === session.agent) ??
      (session.agent === "claude" ? CLAUDE_ACTION : CODEX_ACTION);
    onOpenAgent(
      launchedAgent(action, {
        resumed: { prompt: session.title, reply: session.reply, landedAt: DEMO_EPOCH - session.agoMs },
      }),
    );
  };

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto_1fr] overflow-y-auto bg-[#1a1a1a] px-6">
      <p className="self-end pb-5 pt-10 text-center text-[13px] text-[#8e8e8e]">
        Open a terminal or start an agent
      </p>
      <div className="mx-auto w-full max-w-xl">
        <LaunchpadPrompt
          agents={agents}
          option={option}
          onPick={setPicked}
          value={value}
          onChange={setValue}
          onStart={start}
        />
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 self-start pb-10 pt-5">
        {recent.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
              Pick up where you left off
            </span>
            <div className="flex flex-col gap-1">
              {recent.map((session) => (
                <LaunchpadSessionRow key={session.key} session={session} onResume={resume} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
