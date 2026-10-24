import { useEffect, useMemo, useRef, useState } from "react";
import { main } from "../../bridge/models";
import { useBranchSearch } from "../hooks/useBranchSearch";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { branchKey, branchMatches, RemoteBadge } from "./branchUtils";
import { BranchIcon, CheckIcon, ChevronDownIcon, CloudBranchIcon } from "./icons";

type Branch = main.Branch;

interface BranchPickerProps {
  projectPath: string;
  label: string;
  // The recent branches shown before anything is typed.
  branches: Branch[];
  // Applied to search results too; keep it stable (useCallback).
  filter?: (b: Branch) => boolean;
  isSelected: (b: Branch) => boolean;
  onSelect: (b: Branch) => void;
  disabled?: boolean;
  menuClassName?: string;
}

// A branch chip that opens a searchable list of local and remote branches.
export function BranchPicker({
  projectPath,
  label,
  branches,
  filter,
  isSelected,
  onSelect,
  disabled,
  menuClassName = "w-96",
}: BranchPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchResults = useBranchSearch(projectPath, query, open, filter);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const ref = useOutsideClick<HTMLDivElement>(close, open);
  useDismissOnEscape(open, close);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const shown = useMemo(() => {
    if (!query) return branches;
    if (searchResults !== null) return searchResults;
    // Fallback during the debounce window: filter the cached recent list.
    return branches.filter((b) => branchMatches(b, query));
  }, [branches, query, searchResults]);

  const choose = (b: Branch) => {
    close();
    onSelect(b);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--text-muted)]/50 hover:bg-[var(--bg-hover)] disabled:opacity-50"
      >
        <BranchIcon size={11} />
        <span className="max-w-[180px] truncate">{label || "…"}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-10 mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-lg ${menuClassName}`}
        >
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (shown[0]) choose(shown[0]);
              }}
              placeholder="Search branches"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-md bg-[var(--bg-hover)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {shown.map((b) => {
              const selected = isSelected(b);
              return (
                <button
                  type="button"
                  key={branchKey(b)}
                  onClick={() => choose(b)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--bg-hover)] ${
                    selected ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {b.remote ? <CloudBranchIcon size={10} /> : <BranchIcon size={10} />}
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.remote && <RemoteBadge remote={b.remote} />}
                  {selected && <CheckIcon />}
                </button>
              );
            })}
            {shown.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--text-muted)]">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
