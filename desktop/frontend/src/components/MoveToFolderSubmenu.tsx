import { FolderIcon } from "./icons";
import { ContextMenuSubmenu } from "./ui/ContextMenuSubmenu";
import { MoveToFolderItems, type MoveToFolderItemsProps } from "./MoveToFolderItems";

interface MoveToFolderSubmenuProps extends MoveToFolderItemsProps {
  // Disable the whole submenu (e.g. nothing selected / busy).
  disabled?: boolean;
}

export function MoveToFolderSubmenu({ disabled, ...items }: MoveToFolderSubmenuProps) {
  return (
    <ContextMenuSubmenu label="Move to folder" icon={<FolderIcon />} disabled={disabled}>
      <MoveToFolderItems {...items} />
    </ContextMenuSubmenu>
  );
}
