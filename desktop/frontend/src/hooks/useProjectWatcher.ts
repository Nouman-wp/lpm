import { useEffect } from "react";
import {
  StartWatchingProject,
  StopWatchingProject,
} from "../../bridge/commands";
import { REALM } from "../mirror";

// Drives the file watch this window keeps on the given root. Each window has
// its own, on the machine the project lives on; naming the root on stop routes
// it there and keeps a late stop from ending the watch that replaced it.
export function useProjectWatcher(root: string | null | undefined): void {
  useEffect(() => {
    if (!root) return;
    StartWatchingProject(root, REALM.id).catch(() => {});
    return () => {
      StopWatchingProject(root, REALM.id).catch(() => {});
    };
  }, [root]);
}
