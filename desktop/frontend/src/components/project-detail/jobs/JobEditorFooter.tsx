import { useMemo } from "react";
import type { JobDraft } from "../../../jobsFormat";
import { draftToSchedule } from "../../../jobsScheduleDraft";
import { describeFirstRun } from "../../../jobsFirstRun";
import { enterHint } from "../../../shortcutHints";

interface JobEditorFooterProps {
  draft: JobDraft;
  isEditing: boolean;
  // What still blocks saving, once the user has started editing.
  hint: string | null;
  saving: boolean;
  imagesPending: boolean;
  canSave: boolean;
  onSave: () => void;
  onDelete?: () => void;
}

export function JobEditorFooter({
  draft,
  isEditing,
  hint,
  saving,
  imagesPending,
  canSave,
  onSave,
  onDelete,
}: JobEditorFooterProps) {
  const run = useMemo(
    () => describeFirstRun(draftToSchedule(draft), isEditing ? "Next run" : "First run"),
    [draft, isEditing],
  );
  const busy = imagesPending || saving;

  return (
    <footer className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-6 py-4">
      <div className="min-w-0">
        {hint ? (
          <p className="truncate text-[12px] text-[var(--text-muted)]">{hint}</p>
        ) : (
          run && (
            <>
              <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                {run.first}
              </p>
              {run.then && (
                <p className="truncate text-[12px] text-[var(--text-muted)]">{run.then}</p>
              )}
            </>
          )
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--accent-red)]/10 disabled:opacity-40"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-[13px] font-medium text-[var(--bg-primary)] shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {imagesPending
            ? "Attaching images…"
            : saving
              ? isEditing
                ? "Saving…"
                : "Creating…"
              : isEditing
                ? "Save changes"
                : "Create job"}
          {!busy && (
            <kbd className="font-sans text-[11px] font-normal opacity-50">
              {enterHint({ meta: true })}
            </kbd>
          )}
        </button>
      </div>
    </footer>
  );
}
