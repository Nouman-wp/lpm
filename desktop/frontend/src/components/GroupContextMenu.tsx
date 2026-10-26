import { FolderOpen } from "lucide-react";
import { FolderIcon, PencilIcon, TrashIcon } from "./icons";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { ContextMenuSeparator } from "./ui/ContextMenuSeparator";
import { ContextMenuShell } from "./ui/ContextMenuShell";
import { deleteWithProjectsLabel } from "../removalGroups";

interface GroupContextMenuProps {
  x: number;
  y: number;
  // The projects the folder holds, copies included.
  projectCount: number;
  onRename: () => void;
  onNewFolder: () => void;
  // Drops the folder; its projects move out of it.
  onDeleteFolder: () => void;
  // Absent where the folder's projects can't be deleted from here.
  onDeleteWithProjects?: () => void;
  onClose: () => void;
}

export function GroupContextMenu({
  x,
  y,
  projectCount,
  onRename,
  onNewFolder,
  onDeleteFolder,
  onDeleteWithProjects,
  onClose,
}: GroupContextMenuProps) {
  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <ContextMenuShell x={x} y={y} minWidth={180} onClose={onClose}>
      <ContextMenuItem label="Rename folder" icon={<PencilIcon />} onClick={close(onRename)} />
      <ContextMenuItem label="New folder" icon={<FolderIcon />} onClick={close(onNewFolder)} />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={projectCount > 0 ? "Delete folder, keep projects" : "Delete folder"}
        icon={<FolderOpen size={14} />}
        onClick={close(onDeleteFolder)}
      />
      {onDeleteWithProjects && projectCount > 0 && (
        <ContextMenuItem
          destructive
          label={deleteWithProjectsLabel(projectCount)}
          icon={<TrashIcon />}
          onClick={close(onDeleteWithProjects)}
        />
      )}
    </ContextMenuShell>
  );
}
