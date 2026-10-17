import { FolderOpen } from "lucide-react";
import { FolderIcon, PencilIcon, TrashIcon } from "./icons";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { ContextMenuSeparator } from "./ui/ContextMenuSeparator";
import { ContextMenuShell } from "./ui/ContextMenuShell";

interface GroupContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onNewFolder: () => void;
  // Drops the folder but keeps its projects; absent for an empty folder.
  onUngroup?: () => void;
  // Absent where the folder's projects can't be deleted from here.
  onDelete?: () => void;
  onClose: () => void;
}

export function GroupContextMenu({
  x,
  y,
  onRename,
  onNewFolder,
  onUngroup,
  onDelete,
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
      {(onUngroup || onDelete) && <ContextMenuSeparator />}
      {onUngroup && (
        <ContextMenuItem
          label="Ungroup"
          title="Remove the folder and keep its projects"
          icon={<FolderOpen size={14} />}
          onClick={close(onUngroup)}
        />
      )}
      {onDelete && (
        <ContextMenuItem
          destructive
          label="Delete folder"
          icon={<TrashIcon />}
          onClick={close(onDelete)}
        />
      )}
    </ContextMenuShell>
  );
}
