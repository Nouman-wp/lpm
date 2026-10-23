import { useState } from "react";
import { Columns2 } from "lucide-react";
import { MAX_SIDE_BY_SIDE } from "../sideBySide";
import type { ProjectGroup } from "../types";
import { FolderIcon, TrashIcon } from "./icons";
import { MoveToFolderItems } from "./MoveToFolderItems";
import { ContextMenuShell } from "./ui/ContextMenuShell";
import { Kbd } from "./ui/Kbd";

interface SidebarSelectionBarProps {
  count: number;
  busy: boolean;
  width: number;
  // Absent unless the selection fits side by side.
  onSideBySide?: () => void;
  // Null when the selection's machine doesn't share its folders.
  folders: {
    groups: ProjectGroup[];
    anyInGroup: boolean;
    onMoveToGroup: (groupId: string | null) => void;
    onCreateGroupWith: () => void;
  } | null;
  onRemove: () => void;
  onDone: () => void;
  // The sidebar leaves select mode on Escape only while no menu is open.
  onMenuOpenChange: (open: boolean) => void;
}

const BUTTON =
  "flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2 text-[11px] font-medium transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0";

// Select mode's actions, under the list instead of only in a right-click menu.
export function SidebarSelectionBar({
  count,
  busy,
  width,
  onSideBySide,
  folders,
  onRemove,
  onDone,
  onMenuOpenChange,
}: SidebarSelectionBarProps) {
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number } | null>(null);
  const showFolderMenu = (next: { x: number; y: number } | null) => {
    setFolderMenu(next);
    onMenuOpenChange(next !== null);
  };
  const none = count === 0 || busy;

  return (
    <div className="px-2 pb-2" style={{ minWidth: width }}>
      <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2 shadow-lg">
        <div className="flex items-center justify-between px-0.5 text-[11px] text-[var(--text-secondary)]">
          <span>
            <span className="font-semibold text-[var(--text-primary)]">{count}</span> selected
          </span>
          <button
            type="button"
            onClick={onDone}
            className="flex items-center gap-1.5 rounded px-1 font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Done <Kbd>esc</Kbd>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onSideBySide}
            disabled={!onSideBySide}
            title={onSideBySide ? undefined : `Pick 2 to ${MAX_SIDE_BY_SIDE} projects`}
            className={`${BUTTON} text-[var(--text-primary)]`}
          >
            <Columns2 />
            <span className="truncate">Side by side</span>
          </button>
          <button
            type="button"
            // The menu's outside-click would otherwise close it and this click reopen it.
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              showFolderMenu(folderMenu ? null : { x: r.left, y: r.bottom + 4 });
            }}
            disabled={!folders || none}
            className={`${BUTTON} text-[var(--text-primary)]`}
          >
            <FolderIcon />
            <span className="truncate">To folder</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={none}
          className={`${BUTTON} text-[var(--accent-red-text)]`}
        >
          <TrashIcon />
          Remove {count}…
        </button>
      </div>
      {folderMenu && folders && (
        <ContextMenuShell x={folderMenu.x} y={folderMenu.y} minWidth={180} onClose={() => showFolderMenu(null)}>
          <MoveToFolderItems
            groups={folders.groups}
            showRemove={folders.anyInGroup}
            onMoveToGroup={folders.onMoveToGroup}
            onCreateGroupWith={folders.onCreateGroupWith}
            onClose={() => showFolderMenu(null)}
          />
        </ContextMenuShell>
      )}
    </div>
  );
}
