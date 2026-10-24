import { useLayoutEffect, useRef, useState } from "react";
import { BASE_LEFT_PX, INDENT_PX, TreeChevron } from "../treeRow";
import { FileTypeIcon } from "./FileTypeIcon";
import { FILES_ROW_PX } from "./FilesRow";

// The name being typed for a row: a new entry's, or one being renamed.
export interface NameEditView {
  path: string;
  initial: string;
  isDir: boolean;
  problem: string | null;
  busy: boolean;
  onChange: (name: string) => void;
  onCommit: (name: string) => void;
  onBlur: (name: string) => void;
  onCancel: () => void;
}

const INPUT_CLASS =
  "h-5 min-w-0 flex-1 rounded-sm border bg-[var(--bg-secondary)] px-1 text-xs text-[var(--text-primary)] outline-none";

// A tree row turned into a name field: ↵ commits, Esc cancels, and what's
// wrong with the name shows under it. A file's name opens with the part
// before its extension selected, so typing replaces just that.
export function FilesNameInput({ edit, depth }: { edit: NameEditView; depth: number }) {
  const [name, setName] = useState(edit.initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dot = edit.isDir ? -1 : edit.initial.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : edit.initial.length);
    // Only the first mount places the caret; typing moves it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected
      style={{ height: FILES_ROW_PX, paddingLeft: `${depth * INDENT_PX + BASE_LEFT_PX}px` }}
      className="relative flex items-center gap-1.5 bg-[var(--bg-active)] pr-2.5"
    >
      {edit.isDir ? (
        <span className="flex w-[26px] shrink-0 items-center justify-center">
          <TreeChevron open={false} />
        </span>
      ) : (
        <FileTypeIcon name={name} />
      )}
      <input
        ref={inputRef}
        type="text"
        value={name}
        readOnly={edit.busy}
        onChange={(e) => {
          setName(e.target.value);
          edit.onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            edit.onCommit(name);
          } else if (e.key === "Escape") {
            e.preventDefault();
            edit.onCancel();
          }
        }}
        onBlur={() => edit.onBlur(name)}
        aria-label={edit.initial ? `Rename ${edit.initial}` : edit.isDir ? "New folder name" : "New file name"}
        aria-invalid={edit.problem !== null}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-text-scope=""
        className={`${INPUT_CLASS} ${
          edit.problem ? "border-[var(--accent-red)]" : "border-[var(--accent-cyan)]"
        }`}
      />
      {edit.problem && (
        <p
          role="alert"
          className="absolute right-2.5 top-full z-20 -mt-0.5 rounded-sm border border-[var(--accent-red)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px] text-[var(--accent-red-text)] shadow-md"
          style={{ left: `${depth * INDENT_PX + BASE_LEFT_PX + 32}px` }}
        >
          {edit.problem}
        </p>
      )}
    </div>
  );
}
