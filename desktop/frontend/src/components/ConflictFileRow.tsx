import { CircleAlert, CircleCheck } from "lucide-react";
import { fileStateLabel, type ConflictFile, type ConflictSide } from "../mergeConflicts";

const ACTION =
  "shrink-0 rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

interface ConflictFileRowProps {
  file: ConflictFile;
  side?: ConflictSide;
  legacy: boolean;
  disabled: boolean;
  onOpen: () => void;
  onTakeSide: (side: ConflictSide) => void;
  onMarkResolved: () => void;
}

export function ConflictFileRow({
  file,
  side,
  legacy,
  disabled,
  onOpen,
  onTakeSide,
  onMarkResolved,
}: ConflictFileRowProps) {
  const { resolved } = file;
  const label = fileStateLabel(file, side, legacy);
  return (
    <li className="flex items-center gap-2 px-4 py-1.5">
      {resolved ? (
        <CircleCheck size={13} className="shrink-0 text-[var(--accent-green)]" aria-label="Resolved" />
      ) : (
        <CircleAlert size={13} className="shrink-0 text-[var(--accent-red)]" aria-label="Has conflicts" />
      )}
      <span
        className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
          resolved ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
        }`}
        title={file.path}
      >
        {file.path}
      </span>
      {label && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{label}</span>}
      <button onClick={onOpen} className={ACTION}>
        Open
      </button>
      {!resolved && !legacy && (
        <>
          {file.conflicts === 0 && (
            <button
              onClick={onMarkResolved}
              disabled={disabled}
              title="Stage the file as resolved"
              className={ACTION}
            >
              Mark resolved
            </button>
          )}
          <button
            onClick={() => onTakeSide("ours")}
            disabled={disabled}
            title="Keep this branch's version"
            className={ACTION}
          >
            Use ours
          </button>
          <button
            onClick={() => onTakeSide("theirs")}
            disabled={disabled}
            title="Take the incoming branch's version"
            className={ACTION}
          >
            Use theirs
          </button>
        </>
      )}
    </li>
  );
}
