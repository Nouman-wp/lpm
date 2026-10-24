import { useAppStore } from "../../store/app";
import { useComposerStore } from "../../store/composer";
import { insertComposerText } from "../../store/composerDrafts";
import { useTerminalTargets, type TerminalTargetInfo } from "../../store/terminalTargets";

// The terminal a mention goes to: the one whose input the project showed
// last, else its first tab.
export function mentionTarget(projectName: string): TerminalTargetInfo | null {
  const targets = useTerminalTargets.getState().byProject[projectName] ?? [];
  const recent = useComposerStore.getState().recent[projectName];
  return targets.find((t) => t.id === recent) ?? targets[0] ?? null;
}

// "@path" into that terminal's input. An input that isn't on screen gets it in
// its parked prompt and is brought into view, open.
export function mentionInAgent(projectName: string, target: TerminalTargetInfo, path: string): void {
  if (insertComposerText(target.id, target.historyKey, `@${path} `)) return;
  useComposerStore.getState().setOpen(true);
  useAppStore.getState().focusProjectTerminal(projectName, target.id);
}
