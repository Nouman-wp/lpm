import { FolderIcon } from "./icons";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { ContextMenuSeparator } from "./ui/ContextMenuSeparator";
import type { ProjectGroup } from "../types";

export interface MoveToFolderItemsProps {
  groups: ProjectGroup[];
  // The folder a target already lives in, disabled in the list (single project).
  disabledGroupId?: string | null;
  // Whether to offer "Remove from folder".
  showRemove: boolean;
  onMoveToGroup: (groupId: string | null) => void;
  onCreateGroupWith: () => void;
  onClose: () => void;
}

export function MoveToFolderItems({
  groups,
  disabledGroupId,
  showRemove,
  onMoveToGroup,
  onCreateGroupWith,
  onClose,
}: MoveToFolderItemsProps) {
  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <>
      <ContextMenuItem label="New folder…" icon={<FolderIcon />} onClick={close(onCreateGroupWith)} />
      {(groups.length > 0 || showRemove) && <ContextMenuSeparator />}
      {groups.map((g) => (
        <ContextMenuItem
          key={g.id}
          label={g.name}
          disabled={disabledGroupId != null && g.id === disabledGroupId}
          onClick={close(() => onMoveToGroup(g.id))}
        />
      ))}
      {showRemove && (
        <ContextMenuItem label="Remove from folder" onClick={close(() => onMoveToGroup(null))} />
      )}
    </>
  );
}
