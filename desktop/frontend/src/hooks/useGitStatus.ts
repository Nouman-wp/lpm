import { useCallback, useEffect, useState } from "react";
import { GitStatus as ApiGitStatus, ListBranches } from "../../bridge/commands";
import { main } from "../../bridge/models";
import { useEventListener } from "./useEventListener";
import { useGitChanged } from "./useGitChanged";

type GitStatus = main.GitStatus;
type Branch = main.Branch;

export function useGitStatus(projectPath: string, active = true) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    try {
      const [s, b] = await Promise.all([
        ApiGitStatus(projectPath),
        ListBranches(projectPath).catch(() => [] as Branch[]),
      ]);
      setStatus(s);
      setBranches(b);
    } catch {
      // Swallow: the caller typically hides itself when status.isGitRepo is false.
    }
  }, [projectPath]);

  // The file watcher follows only the project in front, so a status kept while
  // hidden can miss an auto pull or a commit; showing it again recounts.
  useEffect(() => {
    if (active) refresh();
  }, [refresh, active]);

  useEventListener("focus", refresh);

  useGitChanged(projectPath, refresh);

  return { status, branches, refresh };
}
