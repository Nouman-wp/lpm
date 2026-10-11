import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { FilesPane } from "./files/FilesPane";
import type { CommitReview } from "./files/useCommitReview";

const REVIEW_ID = "commit-review";

interface Props {
  open: boolean;
  onClose: () => void;
  projectName: string;
  projectPath: string;
  selected: Set<string>;
  onSetSelection: (paths: string[], select: boolean) => void;
}

// The commit's review is the Review changes tab itself, in a dialog, with a
// checkbox on every row for what goes into the commit.
export function SideBySideDiffModal({
  open,
  onClose,
  projectName,
  projectPath,
  selected,
  onSetSelection,
}: Props) {
  const [dirtyCount, setDirtyCount] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirtyCount(0);
    setConfirmDiscard(false);
  }, [open]);

  // The diffs are editable; closing unmounts them and drops unsaved edits, and
  // the commit stages from disk, so confirm before throwing edits away.
  const review = useMemo<CommitReview>(
    () => ({
      selected,
      onSetSelection,
      onClose: () => (dirtyCount > 0 ? setConfirmDiscard(true) : onClose()),
      onDirtyChange: setDirtyCount,
      dialogZIndexClassName: "z-[120]",
    }),
    [selected, onSetSelection, dirtyCount, onClose],
  );

  return (
    <Modal
      open={open}
      onClose={review.onClose}
      zIndexClassName="z-[110]"
      closeOnEscape={!confirmDiscard}
      closeOnBackdrop={!confirmDiscard}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      contentClassName="flex h-[90vh] w-[min(1480px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
    >
      <div className="min-h-0 flex-1">
        <FilesPane
          tabId={REVIEW_ID}
          paneId={REVIEW_ID}
          projectRoot={projectPath}
          projectName={projectName}
          active
          focused
          review={review}
        />
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved edits?"
        body={`You have unsaved changes in ${dirtyCount} file${
          dirtyCount === 1 ? "" : "s"
        }. Closing will discard them — the commit only includes saved changes.`}
        cancelLabel="Keep editing"
        confirmLabel="Discard & close"
        variant="destructive"
        zIndexClassName="z-[120]"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </Modal>
  );
}
