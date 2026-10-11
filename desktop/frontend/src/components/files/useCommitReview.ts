import { useCallback, useEffect, useMemo, useState } from "react";
import { changedUnder, selectionChecks } from "./commitChecks";
import type { Item } from "./treeModel";
import type { ChangedFile } from "./useChangedFiles";

// The Files tab opened as the commit dialog's review rather than as a tab: the
// rail stays on the changes and every row carries the commit checkbox.
export interface CommitReview {
  selected: Set<string>;
  onSetSelection: (paths: string[], select: boolean) => void;
  onClose: () => void;
  // How many files hold unsaved edits, so closing can confirm dropping them.
  onDirtyChange: (count: number) => void;
  // The dialog's layer, for the confirmations the pane raises over it.
  dialogZIndexClassName: string;
}

const NO_PATHS: ReadonlySet<string> = new Set();

// What the pane needs for a review: the rail's checkboxes (a file toggles
// itself, a folder every changed file beneath it), and the unsaved edits of the
// open file and the diff stack together, which the rail marks and a review
// reports up.
export function useCommitReview(
  files: readonly ChangedFile[],
  bufferDirty: ReadonlySet<string>,
  review: CommitReview | undefined,
) {
  const [stackDirty, setStackDirty] = useState<ReadonlySet<string>>(NO_PATHS);
  const dirtyPaths = useMemo(
    () => (stackDirty.size ? new Set([...bufferDirty, ...stackDirty]) : bufferDirty),
    [bufferDirty, stackDirty],
  );
  const onDirtyChange = review?.onDirtyChange;
  useEffect(() => {
    onDirtyChange?.(dirtyPaths.size);
  }, [onDirtyChange, dirtyPaths]);

  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const selected = review?.selected;
  const onSetSelection = review?.onSetSelection;
  const checks = useMemo(
    () => (selected ? selectionChecks(paths, selected) : undefined),
    [paths, selected],
  );
  const onCheck = useCallback(
    (item: Item, select: boolean) =>
      onSetSelection?.(item.isDir ? changedUnder(paths, item.path) : [item.path], select),
    [paths, onSetSelection],
  );

  return {
    dirtyPaths,
    onStackDirty: setStackDirty,
    checks,
    onCheck: onSetSelection ? onCheck : undefined,
  };
}
