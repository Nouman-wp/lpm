import { useCallback, type RefObject } from "react";
import { toast } from "sonner";
import { StartTerminal, StartTerminalForRestore, StopTerminal } from "../../../bridge/commands";
import { disposeInteractivePaneSession } from "../../components/InteractivePane";
import { isPeerName } from "../../peer/markers";
import { collectPanes, isTerminalTab, type PaneNode } from "../../paneTree";
import { swapTerminal } from "./swapTerminal";

interface UseTerminalRestartProps {
  projectName: string;
  treeRef: RefObject<PaneNode | null>;
  applyTree: (next: PaneNode | null, focus?: string | null) => void;
  scheduleCmdInject: (id: string, cmd: string, prompt?: string | string[]) => void;
}

// Run a terminal whose process has ended again in its own tab: a fresh shell
// that resumes the tab's agent session, or runs the command it was opened with.
// A tab on another Mac is that Mac's to restart.
export function useTerminalRestart({
  projectName,
  treeRef,
  applyTree,
  scheduleCmdInject,
}: UseTerminalRestartProps) {
  return useCallback(
    async (oldId: string) => {
      if (isPeerName(oldId)) return;
      const hostOf = () =>
        treeRef.current
          ? collectPanes(treeRef.current).find((p) =>
              p.tabs.some((t) => t.id === oldId && isTerminalTab(t)),
            )
          : undefined;
      const tab = hostOf()?.tabs.find((t) => t.id === oldId);
      if (!tab) return;
      let newId: string;
      try {
        newId = tab.actionName
          ? await StartTerminalForRestore(projectName, tab.actionName)
          : await StartTerminal(projectName);
      } catch (err) {
        toast.error(`Couldn't restart the terminal: ${err}`);
        return;
      }
      const host = hostOf();
      if (!host || !treeRef.current) {
        StopTerminal(newId).catch(() => {});
        return;
      }
      applyTree(swapTerminal(treeRef.current, host.id, oldId, newId));
      // The pane still mounted on oldId must unmount before its session goes.
      setTimeout(() => disposeInteractivePaneSession(oldId), 0);
      const cmd = tab.resumeCmd ?? tab.startCmd;
      if (cmd) scheduleCmdInject(newId, cmd);
    },
    [projectName, treeRef, applyTree, scheduleCmdInject],
  );
}
