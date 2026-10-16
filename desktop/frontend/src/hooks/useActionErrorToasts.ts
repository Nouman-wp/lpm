import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { actionErrorNotices } from "../actionErrorNotices";
import { displayNameForProjectName } from "../components/ProjectNameDisplay";
import { IS_MIRROR_WINDOW } from "../mirror";
import { useAppStore } from "../store/app";

// An action whose config doesn't parse is left out of its project; say so once
// per problem, with a way into the editor. A problem fixed and made again is
// told again. Main window only — a mirror window would double-toast.
export function useActionErrorToasts(): void {
  const projects = useAppStore((s) => s.projects);
  const told = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (IS_MIRROR_WINDOW) return;
    const notices = actionErrorNotices(projects);
    for (const [key, { error, project }] of notices) {
      if (told.current.has(key)) continue;
      const name = displayNameForProjectName(project.name, projects);
      toast.warning(`${name}: an action was left out because its config is invalid`, {
        id: `action-error:${key}`,
        description: error,
        duration: 15000,
        action: {
          label: "Edit config",
          onClick: () => useAppStore.getState().openProjectDetailView(project.name, "config"),
        },
      });
    }
    told.current = new Set(notices.keys());
  }, [projects]);
}
