import { main } from "../../bridge/models";
import { relativeTime } from "../relativeTime";
import { BranchActionButton } from "./BranchActionButton";
import { branchKeyLabel } from "./branchKeys";
import { RemoteBadge } from "./branchUtils";
import { BranchIcon, CloudBranchIcon, CloudOffIcon, CopyIcon, PencilIcon, TrashIcon } from "./icons";

interface BranchRowProps {
  branch: main.Branch;
  index: number;
  active: boolean;
  isCurrent: boolean;
  uncommitted: number;
  busy: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onCheckout: () => void;
  onCopy: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onRemoveRemote: () => void;
}

export function BranchRow({
  branch: b,
  index,
  active,
  isCurrent,
  uncommitted,
  busy,
  renaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onCheckout,
  onCopy,
  onStartRename,
  onDelete,
  onRemoveRemote,
}: BranchRowProps) {
  const age = relativeTime(b.committerDate);
  const canRename = !b.remote;
  const canDelete = !b.remote && !isCurrent;
  return (
    <div
      data-branch-index={index}
      className={`group relative flex w-full items-center transition-colors hover:bg-[var(--bg-hover)] ${
        active ? "bg-[var(--bg-hover)]" : ""
      }`}
    >
      {renaming ? (
        <div className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px]">
          <BranchIcon size={14} />
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRenameSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onRenameCancel();
              }
            }}
            onBlur={onRenameCancel}
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            title="Save"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRenameSubmit}
            disabled={busy || !renameValue.trim() || renameValue.trim() === b.name}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--accent-blue)] transition-colors hover:bg-[var(--bg-active)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={onCheckout}
            disabled={busy}
            title={b.remote ? `Create local tracking branch from ${b.remote}/${b.name}` : undefined}
            className={`flex min-w-0 flex-1 items-center gap-2.5 px-4 py-2 text-left text-[13px] disabled:opacity-50 ${isCurrent ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)]"}`}
          >
            {b.remote ? <CloudBranchIcon size={14} /> : <BranchIcon size={14} />}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{b.name}</span>
                {b.remote && <RemoteBadge remote={b.remote} />}
              </span>
              {isCurrent && uncommitted > 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  Uncommitted: {uncommitted} file{uncommitted === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1 pr-4">
            <div
              className={`flex items-center gap-0.5 pr-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${
                active ? "opacity-100" : "opacity-0"
              }`}
            >
              <BranchActionButton title={`Copy branch name (${branchKeyLabel("copy")})`} onClick={onCopy}>
                <CopyIcon size={13} />
              </BranchActionButton>
              {canRename && (
                <BranchActionButton
                  title={`Rename branch (${branchKeyLabel("rename")})`}
                  onClick={onStartRename}
                >
                  <PencilIcon size={13} />
                </BranchActionButton>
              )}
              {canDelete && (
                <BranchActionButton
                  title={`Delete branch (${branchKeyLabel("delete")})`}
                  onClick={onDelete}
                  danger
                >
                  <TrashIcon size={13} />
                </BranchActionButton>
              )}
              {b.remote && (
                <BranchActionButton
                  title={`Remove from list (${branchKeyLabel("delete")})`}
                  onClick={onRemoveRemote}
                >
                  <CloudOffIcon size={13} />
                </BranchActionButton>
              )}
            </div>
            {age && <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{age}</span>}
          </div>
        </>
      )}
    </div>
  );
}
