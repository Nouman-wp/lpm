import { CollapseIcon, ExpandIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { ContextMenuItem } from "../ui/ContextMenuItem";
import { ContextMenuSeparator } from "../ui/ContextMenuSeparator";
import { ContextMenuShell } from "../ui/ContextMenuShell";

interface ZoneContextMenuProps {
  x: number;
  y: number;
  canRemoveLayer: boolean;
  collapsed: boolean;
  // The open layer's label, when it has one.
  layerLabel?: string;
  onNewLayer: () => void;
  onEdit: () => void;
  onToggleCollapsed: () => void;
  onRemoveLayer: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function ZoneContextMenu({
  x,
  y,
  canRemoveLayer,
  collapsed,
  layerLabel,
  onNewLayer,
  onEdit,
  onToggleCollapsed,
  onRemoveLayer,
  onRemove,
  onClose,
}: ZoneContextMenuProps) {
  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <ContextMenuItem label="New layer" icon={<PlusIcon />} onClick={close(onNewLayer)} />
      <ContextMenuItem label="Edit zone…" icon={<PencilIcon />} onClick={close(onEdit)} />
      <ContextMenuItem
        label={collapsed ? "Expand zone" : "Collapse zone"}
        icon={collapsed ? <ExpandIcon /> : <CollapseIcon />}
        onClick={close(onToggleCollapsed)}
      />
      <ContextMenuSeparator />
      {canRemoveLayer && (
        <ContextMenuItem
          destructive
          label={layerLabel ? `Remove layer “${layerLabel}”` : "Remove layer"}
          icon={<TrashIcon />}
            onClick={close(onRemoveLayer)}
        />
      )}
      <ContextMenuItem
        destructive
        label="Remove zone"
        icon={<TrashIcon />}
        onClick={close(onRemove)}
      />
    </ContextMenuShell>
  );
}
