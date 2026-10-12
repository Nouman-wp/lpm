import { autoPullState, followLabel, normalizeAutoPullMode } from "../autoPull";
import { setProjectAutoPull } from "../autoPullRun";
import { useAppStore } from "../store/app";
import { useSettingsStore } from "../store/settings";
import { CheckIcon, DownloadIcon } from "./icons";
import { displayNameForProjectName } from "./ProjectNameDisplay";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { ContextMenuSubmenu } from "./ui/ContextMenuSubmenu";

// Git › Auto pull: follow (the Settings default, or the parent for a copy), On
// or Off for this project alone. Turning off one copy leaves its siblings alone.
export function AutoPullSubmenu({ projectName, onClose }: { projectName: string; onClose: () => void }) {
  const projects = useAppStore((s) => s.projects);
  const mode = useSettingsStore((s) => normalizeAutoPullMode(s.autoPull));
  const project = projects.find((p) => p.name === projectName);
  if (!project) return null;

  const parentLabel = project.parentName ? displayNameForProjectName(project.parentName, projects) : undefined;
  const state = autoPullState(project, projects, mode);
  const off = mode === "off";
  const pick = (value: boolean | null) => () => {
    onClose();
    void setProjectAutoPull(project.name, value);
  };
  const check = (on: boolean) => <span className="flex w-3 justify-end">{on && <CheckIcon />}</span>;

  return (
    <ContextMenuSubmenu
      label={
        <span className="flex items-center gap-1.5">
          Auto pull
          <span className="text-[10px] text-[var(--text-muted)]">{state.on ? "On" : "Off"}</span>
        </span>
      }
      icon={<DownloadIcon />}
    >
      <div className="w-56">
        <ContextMenuItem
          label={followLabel(project, projects, mode, parentLabel)}
          trailing={check(project.autoPull === undefined)}
          onClick={pick(null)}
          disabled={off}
        />
        <ContextMenuItem label="On" trailing={check(project.autoPull === true)} onClick={pick(true)} disabled={off} />
        <ContextMenuItem label="Off" trailing={check(project.autoPull === false)} onClick={pick(false)} disabled={off} />
        <div className="px-3 pb-1 pt-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
          {off
            ? "Auto pull is off for every project in Settings › General."
            : "Pulls only when the branch has no uncommitted changes and nothing to push."}
        </div>
      </div>
    </ContextMenuSubmenu>
  );
}
