import { memo, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { main } from "../../bridge/models";
import { UndoIcon } from "./icons";
import { BASE_LEFT_PX, INDENT_PX, TreeChevron } from "./treeRow";
import { DiffViewer } from "./DiffViewer";
import { LineCounts } from "./LineCounts";
import { FLAT_LIST_MAX, flatRows, selectedCounts, visibleRows, type TreeRowEntry } from "./changedTreeRows";
import { buildTree, fileDescendants, type FileNode, type FolderNode } from "./changedTree";

type ChangedFile = main.ChangedFile;

export const STATUS_DISPLAY: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  added: { label: "A", color: "text-[var(--accent-green-text)]", dot: "bg-[var(--accent-green)]" },
  untracked: { label: "U", color: "text-[var(--accent-green-text)]", dot: "bg-[var(--accent-green)]" },
  deleted: { label: "D", color: "text-[var(--accent-red-text)]", dot: "bg-[var(--accent-red)]" },
  renamed: { label: "R", color: "text-[var(--accent-cyan-text)]", dot: "bg-[var(--accent-cyan)]" },
  modified: { label: "M", color: "text-[var(--accent-blue-text)]", dot: "bg-[var(--accent-blue)]" },
  conflicted: { label: "!", color: "text-[var(--accent-red-text)]", dot: "bg-[var(--accent-red)]" },
};
export const DEFAULT_STATUS = STATUS_DISPLAY.modified;

export type CheckState = "none" | "some" | "all";

export function checkState(selectedCount: number, total: number): CheckState {
  if (selectedCount === 0) return "none";
  return selectedCount === total ? "all" : "some";
}

export function CheckboxBox({
  state,
  tone = "blue",
}: {
  state: CheckState;
  tone?: "blue" | "green";
}) {
  const colors =
    state === "none"
      ? tone === "green"
        ? "border-[var(--accent-green)]/50"
        : "border-[var(--text-muted)]/25"
      : tone === "green"
        ? "border-[var(--accent-green)] text-[var(--accent-green)]"
        : "border-[var(--accent-blue)] text-[var(--accent-blue)]";
  return (
    <span
      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 ${colors}`}
    >
      {state === "all" && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {state === "some" && (
        <span className="h-[2px] w-[8px] rounded-full bg-current" />
      )}
    </span>
  );
}

export function TriStateCheckbox({
  state,
  onToggle,
  disabled,
  ariaLabel,
  stopPropagation,
}: {
  state: CheckState;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  stopPropagation?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === "some";
  }, [state]);
  return (
    <label
      className="flex shrink-0 cursor-pointer items-center"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <CheckboxBox state={state} />
      <input
        ref={inputRef}
        type="checkbox"
        checked={state === "all"}
        onChange={onToggle}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only"
      />
    </label>
  );
}

// Collapsed rows are about this tall; the virtualizer measures the real ones,
// an open inline diff included.
const ROW_ESTIMATE_PX = 26;

interface ChangedFilesTreeProps {
  // The scrolling box the tree sits in; only the rows in its view mount.
  scrollRef: RefObject<HTMLDivElement | null>;
  files: ChangedFile[];
  selected: Set<string>;
  collapsed: Set<string>;
  expandedFile: string | null;
  diffContent: string;
  diffLoading: boolean;
  busy: boolean;
  onToggleFile: (path: string) => void;
  onSetSelection: (paths: string[], select: boolean) => void;
  onToggleCollapse: (path: string) => void;
  onClickFile: (path: string) => void;
  onDiscardFile: (path: string) => void;
  onDiscardFolder: (info: { name: string; paths: string[] }) => void;
  // Lines each file adds and removes, by path; null until counted.
  lineCounts?: ReadonlyMap<string, FileLines> | null;
}

interface FileLines {
  added: number;
  removed: number;
}

interface RowHandlers {
  toggleFile: (path: string) => void;
  setSelection: (paths: string[], select: boolean) => void;
  toggleCollapse: (path: string) => void;
  clickFile: (path: string) => void;
  discardFile: (path: string) => void;
  discardFolder: (info: { name: string; paths: string[] }) => void;
}

export function ChangedFilesTree(props: ChangedFilesTreeProps) {
  const { files, selected, collapsed, expandedFile, diffContent, diffLoading, busy } = props;
  const tree = useMemo(() => buildTree(files), [files]);
  const counts = useMemo(() => selectedCounts(tree, selected), [tree, selected]);
  // The rows are memoized and reach the caller's latest handlers through this
  // ref, so a parent render with fresh closures (a keystroke in the message)
  // leaves them alone.
  const latest = useRef(props);
  latest.current = props;
  const handlers = useMemo<RowHandlers>(
    () => ({
      toggleFile: (path) => latest.current.onToggleFile(path),
      setSelection: (paths, select) => latest.current.onSetSelection(paths, select),
      toggleCollapse: (path) => latest.current.onToggleCollapse(path),
      clickFile: (path) => latest.current.onClickFile(path),
      discardFile: (path) => latest.current.onDiscardFile(path),
      discardFolder: (info) => latest.current.onDiscardFolder(info),
    }),
    [],
  );

  const flat = files.length <= FLAT_LIST_MAX;
  const rows = useMemo(
    () => (flat ? flatRows(tree) : visibleRows(tree, collapsed)),
    [flat, tree, collapsed],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => props.scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    getItemKey: (index) => rows[index].node.path,
    overscan: 10,
  });

  const renderRow = ({ node, depth }: TreeRowEntry): ReactNode => {
    if (node.kind === "file") {
      const expanded = expandedFile === node.path;
      return (
        <FileRow
          node={node}
          depth={depth}
          dir={flat ? parentDir(node.path) : null}
          lines={props.lineCounts?.get(node.path) ?? null}
          checked={selected.has(node.path)}
          expanded={expanded}
          diffContent={expanded ? diffContent : ""}
          diffLoading={expanded && diffLoading}
          busy={busy}
          handlers={handlers}
        />
      );
    }
    return (
      <FolderRow
        node={node}
        depth={depth}
        isOpen={!collapsed.has(node.path)}
        state={checkState(counts.get(node.path) ?? 0, node.fileCount)}
        busy={busy}
        handlers={handlers}
      />
    );
  };

  return (
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          data-index={item.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${item.start}px)`,
          }}
        >
          {renderRow(rows[item.index])}
        </div>
      ))}
    </div>
  );
}

const FolderRow = memo(function FolderRow({
  node,
  depth,
  isOpen,
  state,
  busy,
  handlers,
}: {
  node: FolderNode;
  depth: number;
  isOpen: boolean;
  state: CheckState;
  busy: boolean;
  handlers: RowHandlers;
}) {
  return (
    <div
      onClick={() => handlers.toggleCollapse(node.path)}
      style={{ paddingLeft: `${depth * INDENT_PX + BASE_LEFT_PX}px` }}
      className="group flex cursor-pointer items-center gap-2 py-[5px] pr-2.5 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <TreeChevron open={isOpen} />
      <TriStateCheckbox
        state={state}
        onToggle={() => handlers.setSelection(fileDescendants(node), state !== "all")}
        disabled={busy}
        stopPropagation
      />
      <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-primary)]">
        {node.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handlers.discardFolder({ name: node.name, paths: fileDescendants(node) });
        }}
        disabled={busy}
        title="Discard all changes in this folder"
        className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--accent-red-text)] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
      >
        <UndoIcon />
      </button>
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
        {node.fileCount}
      </span>
    </div>
  );
});

function parentDir(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : "";
}

const FileRow = memo(function FileRow({
  node,
  depth,
  dir,
  lines,
  checked,
  expanded,
  diffContent,
  diffLoading,
  busy,
  handlers,
}: {
  node: FileNode;
  depth: number;
  dir: string | null;
  lines: FileLines | null;
  checked: boolean;
  expanded: boolean;
  diffContent: string;
  diffLoading: boolean;
  busy: boolean;
  handlers: RowHandlers;
}) {
  const { label: statusLabel, color: statusClr } =
    STATUS_DISPLAY[node.file.status] ?? DEFAULT_STATUS;
  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * INDENT_PX + BASE_LEFT_PX}px` }}
        className={`group flex items-center gap-2 py-[5px] pr-2.5 transition-colors hover:bg-[var(--bg-hover)] ${
          !checked ? "opacity-50" : ""
        }`}
      >
        <span className="w-3 shrink-0" />
        <TriStateCheckbox
          state={checked ? "all" : "none"}
          onToggle={() => handlers.toggleFile(node.path)}
          disabled={busy}
        />
        <span
          className={`w-3 shrink-0 text-center text-[11px] font-bold ${statusClr}`}
          title={node.file.status}
        >
          {statusLabel}
        </span>
        <span
          onClick={() => handlers.clickFile(node.path)}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2"
        >
          <span className="min-w-0 truncate text-xs text-[var(--text-primary)]">{node.name}</span>
          {dir && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-muted)]">{dir}</span>
          )}
        </span>
        {lines && <LineCounts added={lines.added} removed={lines.removed} className="shrink-0 text-[11px]" />}
        <button
          onClick={() => handlers.discardFile(node.path)}
          disabled={busy}
          title="Discard changes to this file"
          className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--accent-red-text)] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
        >
          <UndoIcon />
        </button>
        <span
          className={`shrink-0 text-[11px] text-[var(--text-muted)] transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          &#9654;
        </span>
      </div>
      {expanded && (
        <DiffViewer
          diff={diffContent}
          loading={diffLoading}
          filePath={node.path}
        />
      )}
    </div>
  );
});
