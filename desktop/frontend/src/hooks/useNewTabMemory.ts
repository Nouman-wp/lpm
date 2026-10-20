import { useState } from "react";
import {
  loadNewTabMemory,
  saveNewTabMemory,
  type NewTabDestination,
  type NewTabMemory,
  type NewTabPick,
} from "../newTabPick";
import type { RemoteAgentLaunch } from "../remoteAgentTabs";

export interface NewTabTargets {
  onNewTerminal: () => void;
  // What was typed, run in a new terminal.
  onRunCommand: (command: string) => void;
  onOpenAgent: (launch: RemoteAgentLaunch) => void;
}

// What the + popup and the empty project's launchpad both open from: each
// agent's remembered pick and the last destination. An agent takes what was
// typed as its first prompt and a terminal runs it; left empty, the pick just
// opens.
export function useNewTabMemory({ onNewTerminal, onRunCommand, onOpenAgent }: NewTabTargets) {
  const [memory, setMemory] = useState<NewTabMemory>(loadNewTabMemory);

  const remember = (next: NewTabMemory) => {
    setMemory(next);
    saveNewTabMemory(next);
  };

  const launch = (destination: NewTabDestination, command: string) => {
    saveNewTabMemory({ ...memory, last: destination });
    if (destination !== "terminal") {
      onOpenAgent({ ...memory.picks[destination], prompt: command || undefined });
    } else if (command) onRunCommand(command);
    else onNewTerminal();
  };

  return {
    memory,
    select: (last: NewTabDestination) => remember({ ...memory, last }),
    changePick: (pick: NewTabPick) =>
      remember({ ...memory, picks: { ...memory.picks, [pick.agent]: pick } }),
    launch,
  };
}
