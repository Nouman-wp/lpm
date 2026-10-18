import { useCallback, useEffect, useState } from "react";
import {
  GitDiffStat,
  GitStatus as ApiGitStatus,
  ListBranches,
} from "../../bridge/commands";
import { main } from "../../bridge/models";
import { useEventListener } from "./useEventListener";
import { useGitChanged } from "./useGitChanged";

type GitStatus = main.GitStatus;
type Branch = main.Branch;

export interface DiffStat {
  files: number;
  linesAdded: number;
  linesRemoved: number;
}

export function useGitStatus(projectPath: string, active = true) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [diffStat, setDiffStat] = useState<DiffStat | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    try {
      const [s, b, d] = await Promise.all([
        ApiGitStatus(projectPath),
        ListBranches(projectPath).catch(() => [] as Branch[]),
        // A paired Mac on an older lpm can't count lines; null keeps the plain dot.
        (GitDiffStat(projectPath) as Promise<DiffStat>).catch(() => null),
      ]);
      setStatus(s);
      setBranches(b);
      setDiffStat(d);
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

  return { status, branches, diffStat, refresh };
}
