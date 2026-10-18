import { useEffect, useMemo, useState } from "react";
import { GitFileLineCounts } from "../../bridge/commands";

interface FileLines {
  path: string;
  added: number;
  removed: number;
}

// The lines the selected files add and remove, recounted whenever the file list
// reloads. Null until counted, and on a paired Mac whose older lpm can't count.
export function useSelectedLineCounts(
  projectPath: string,
  files: readonly unknown[],
  selected: ReadonlySet<string>,
) {
  const [counts, setCounts] = useState<Map<string, FileLines> | null>(null);

  useEffect(() => {
    if (!projectPath || files.length === 0) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    (GitFileLineCounts(projectPath) as Promise<FileLines[]>)
      .then((list) => {
        if (!cancelled) setCounts(new Map(list.map((f) => [f.path, f])));
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, files]);

  return useMemo(() => {
    if (!counts) return null;
    let added = 0;
    let removed = 0;
    for (const path of selected) {
      const c = counts.get(path);
      if (!c) continue;
      added += c.added;
      removed += c.removed;
    }
    return { added, removed };
  }, [counts, selected]);
}
