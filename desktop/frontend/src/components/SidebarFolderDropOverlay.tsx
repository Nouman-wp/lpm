import { FolderIcon, PlusIcon } from "./icons";
import { dropOverlayLabel } from "../sidebarFolderDrop";
import type { SidebarDropHover } from "../hooks/useSidebarFolderDrop";

interface SidebarFolderDropOverlayProps {
  hover: SidebarDropHover | null;
}

export function SidebarFolderDropOverlay({ hover }: SidebarFolderDropOverlayProps) {
  if (!hover) return null;
  const { list, folder } = hover;
  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{ left: list.x, top: list.y, width: list.width, height: list.height }}
    >
      <div className="absolute inset-1 rounded-lg border-2 border-dashed border-[var(--accent-cyan)] bg-[color-mix(in_srgb,var(--accent-cyan)_7%,transparent)]" />
      {folder && (
        <div
          className="absolute rounded-md bg-[color-mix(in_srgb,var(--accent-cyan)_16%,transparent)] ring-2 ring-[var(--accent-cyan)]"
          style={{
            left: folder.rect.x - list.x,
            top: folder.rect.y - list.y,
            width: folder.rect.width,
            height: folder.rect.height,
          }}
        />
      )}
      <div className="absolute inset-x-3 bottom-4 flex items-center justify-center">
        <div className="flex max-w-full items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-[12px] font-medium text-[var(--accent-cyan)] shadow-lg ring-1 ring-[var(--accent-cyan)]/50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
          {folder ? <FolderIcon /> : <PlusIcon />}
          <span className="truncate">{dropOverlayLabel(folder?.name)}</span>
        </div>
      </div>
    </div>
  );
}
