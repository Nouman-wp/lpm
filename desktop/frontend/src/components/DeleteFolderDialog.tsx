import { Modal } from "./ui/Modal";
import { folderKeepText } from "../removalGroups";

interface DeleteFolderDialogProps {
  open: boolean;
  folderName: string;
  projectCount: number;
  // Absent where the folder's projects can't be deleted from here.
  onDeleteProjects?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

// Deleting a folder lets go of its projects; deleting them too is the
// separate, red way out.
export function DeleteFolderDialog({
  open,
  folderName,
  projectCount,
  onDeleteProjects,
  onCancel,
  onConfirm,
}: DeleteFolderDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      zIndexClassName="z-[60]"
      contentClassName="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      <h3 className="break-words text-base font-semibold text-[var(--text-primary)]">
        Delete the {folderName} folder?
      </h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{folderKeepText(projectCount)}</p>
      <div className="mt-5 flex items-center gap-2">
        {onDeleteProjects && projectCount > 0 && (
          <button
            onClick={onDeleteProjects}
            className="rounded-lg border border-[color-mix(in_srgb,var(--accent-red)_50%,transparent)] px-3 py-2 text-sm font-medium text-[var(--accent-red-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-red)_10%,transparent)]"
          >
            Delete projects too…
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-all hover:opacity-90"
          >
            Delete folder
          </button>
        </div>
      </div>
    </Modal>
  );
}
