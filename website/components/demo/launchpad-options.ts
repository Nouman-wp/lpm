import { CLAUDE_ACTION, CODEX_ACTION, type DemoAction } from "./projects";

// Ports the app's launchpadTabs: what the empty project's launcher can start
// with its prompt — each header action that opens an agent CLI, or the bare
// CLIs when the project has none.
export function launchpadAgents(actions: DemoAction[]): DemoAction[] {
  const agents = actions.filter((a) => a.display === "header" && a.agent);
  return agents.length > 0 ? agents : [CLAUDE_ACTION, CODEX_ACTION];
}

// A launcher line meant for a shell rather than the agent, written the way a
// shell prompt shows it: "$ npm test". The command without its "$", or null.
export function launchpadCommand(text: string): string | null {
  const match = /^\$(?:\s+|$)/.exec(text);
  return match ? text.slice(match[0].length).trim() : null;
}

// Terminal until something is started; then whatever was last.
let lastPicked = "terminal";

export function loadLaunchpadPick(): string {
  return lastPicked;
}

export function saveLaunchpadPick(id: string): void {
  lastPicked = id;
}

// The agent action as the launcher opens it: none of the seeded session it
// carries for the header button, only what the launcher asked for.
export function launchedAgent(
  action: DemoAction,
  launch: Pick<DemoAction, "firstPrompt" | "resumed">,
): DemoAction {
  return {
    ...action,
    autoPrompt: undefined,
    autoMode: undefined,
    autoSteps: undefined,
    autoIntent: undefined,
    autoAnswerSteps: undefined,
    autoDeferred: undefined,
    ...launch,
  };
}
