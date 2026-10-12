import { useEffect, useState } from "react";
import { GitAutoPullLast } from "../../bridge/commands";
import { commitsText } from "../autoPull";
import { undoAutoPull, type AutoPulled } from "../autoPullRun";
import { relativeTime } from "../relativeTime";
import { useAppStore } from "../store/app";
import { UndoIcon } from "./icons";
import { displayNameForProjectName } from "./ProjectNameDisplay";
import { ContextMenuItem } from "./ui/ContextMenuItem";

// Git › Undo auto pull, while the project's last auto pull can still be taken
// back: same branch, and nothing has moved HEAD since.
export function UndoAutoPullItem({
  projectPath,
  projectName,
  onClose,
}: {
  projectPath: string;
  projectName: string;
  onClose: () => void;
}) {
  const projects = useAppStore((s) => s.projects);
  const [last, setLast] = useState<AutoPulled | null>(null);

  useEffect(() => {
    let cancelled = false;
    GitAutoPullLast(projectPath)
      .then((r) => {
        if (!cancelled) setLast((r as AutoPulled | null) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  if (!last) return null;
  const ago = relativeTime(Math.floor(last.at / 1000));
  return (
    <ContextMenuItem
      label="Undo auto pull"
      description={`${commitsText(last.count)} on ${last.branch}${ago ? ` · ${ago === "now" ? "just now" : `${ago} ago`}` : ""}`}
      icon={<UndoIcon />}
      onClick={() => {
        onClose();
        void undoAutoPull(projectPath, projectName, displayNameForProjectName(projectName, projects));
      }}
    />
  );
}
