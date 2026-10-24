import { SpinnerIcon } from "./project-detail/icons";
import { folderMoveAction, folderMoveNotice, type FolderMoveBlock } from "../renameFolderText";

interface FolderMoveNoticeProps {
  block: FolderMoveBlock;
  clearing: boolean;
  onClear: () => void;
}

export function FolderMoveNotice({ block, clearing, onClear }: FolderMoveNoticeProps) {
  const notice = folderMoveNotice(block);
  if (!notice) return null;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/8 px-3 py-2">
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--accent-amber-text)]">{notice}</p>
      <button
        type="button"
        onClick={onClear}
        disabled={clearing}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--accent-amber)]/40 px-2.5 py-1 text-[12px] font-medium text-[var(--accent-amber-text)] transition-colors hover:bg-[var(--accent-amber)]/12 disabled:opacity-60"
      >
        {clearing && <SpinnerIcon />}
        {clearing ? (block.running ? "Stopping…" : "Closing…") : folderMoveAction(block)}
      </button>
    </div>
  );
}
