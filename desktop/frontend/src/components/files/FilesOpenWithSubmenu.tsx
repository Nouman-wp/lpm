import { launchOpenFileTarget, useOpenFileTargets } from "../../hooks/useOpenFileTargets";
import { OpenTargetIcon } from "../OpenTargetIcon";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuSubmenu } from "../ui/ContextMenuSubmenu";

// The editor header's "Open" choices for any row's file.
export function FilesOpenWithSubmenu({ absPath, onClose }: { absPath: string; onClose: () => void }) {
  const targets = useOpenFileTargets(absPath);
  return (
    <ContextMenuSubmenu label="Open with">
      {targets.map((t) => (
        <ContextMenuItem
          key={t.id}
          label={t.label}
          icon={<OpenTargetIcon target={t} />}
          onClick={() => {
            void launchOpenFileTarget(t, absPath);
            onClose();
          }}
        />
      ))}
    </ContextMenuSubmenu>
  );
}
