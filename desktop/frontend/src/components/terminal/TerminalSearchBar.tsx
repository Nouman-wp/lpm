import { useEffect, useRef, useState } from "react";
import { IconBtn } from "./IconBtn";
import { ArrowDownIcon, ChevronUpIcon, FilterIcon, SearchIcon } from "./icons";
import { XIcon } from "../icons";
import {
  findResultsLabel,
  type FindDirection,
  type FindOptions,
  type FindOutcome,
  type FindResults,
} from "./terminalFind";

interface TerminalSearchBarProps {
  filterMode: boolean;
  matchCount: number;
  onFind: (query: string, direction: FindDirection, options: FindOptions) => FindOutcome;
  onWatchResults: (onResults: (results: FindResults) => void) => () => void;
  onFilterChange: (query: string | null) => void;
  onToggleFilterMode: () => void;
  onClose: () => void;
}

export function TerminalSearchBar({
  filterMode,
  matchCount,
  onFind,
  onWatchResults,
  onFilterChange,
  onToggleFilterMode,
  onClose,
}: TerminalSearchBarProps) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<FindOutcome | null>(null);
  const [results, setResults] = useState<FindResults | null>(null);
  const [options, setOptions] = useState<FindOptions>({ caseSensitive: false, regex: false });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return onWatchResults(setResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An empty query still goes to the terminal so it drops the highlights.
  const find = (value: string, direction: FindDirection, opts: FindOptions = options) => {
    const next = onFind(value, direction, opts);
    setOutcome(value ? next : null);
  };

  // Re-apply the current query whenever the mode flips so toggling between
  // filtering and highlighting takes effect immediately.
  useEffect(() => {
    if (filterMode) {
      setOutcome(null);
      onFilterChange(query || null);
    } else {
      onFilterChange(null);
      if (query) find(query, "next");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (filterMode) {
      onFilterChange(value || null);
      return;
    }
    find(value, "next");
  };

  const toggleOption = (key: keyof FindOptions) => {
    const next = { ...options, [key]: !options[key] };
    setOptions(next);
    if (query) find(query, "next", next);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!filterMode && query) find(query, e.shiftKey ? "prev" : "next");
    }
  };

  const invalid = outcome === "invalid";
  const noMatches = invalid || outcome === "none" || results?.count === 0;
  const findLabel = !query
    ? null
    : invalid
      ? "Invalid pattern"
      : results
        ? findResultsLabel(results)
        : null;

  const inputClass = `w-40 bg-transparent font-mono text-[11px] outline-none placeholder:text-[var(--text-muted)] ${
    !filterMode && query && noMatches ? "text-[var(--accent-red)]" : "text-[var(--text-primary)]"
  }`;

  return (
    <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--terminal-header)] px-2 py-1 shadow-md">
      <span className="text-[var(--text-muted)]">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={filterMode ? "Filter" : "Find"}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={inputClass}
        aria-label={filterMode ? "Filter lines" : "Find in terminal"}
      />
      {filterMode && query && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
          {matchCount}
        </span>
      )}
      {!filterMode && findLabel && (
        <span
          aria-live="polite"
          className={`shrink-0 whitespace-nowrap px-1 text-[10px] tabular-nums ${
            noMatches ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"
          }`}
        >
          {findLabel}
        </span>
      )}
      {!filterMode && (
        <>
          <IconBtn
            onClick={() => toggleOption("caseSensitive")}
            title="Match case"
            active={options.caseSensitive}
          >
            <span className="w-[14px] text-center text-[10px] font-semibold leading-[14px]">Aa</span>
          </IconBtn>
          <IconBtn
            onClick={() => toggleOption("regex")}
            title="Use regular expression"
            active={options.regex}
          >
            <span className="w-[14px] text-center font-mono text-[10px] font-semibold leading-[14px]">.*</span>
          </IconBtn>
        </>
      )}
      <IconBtn
        onClick={onToggleFilterMode}
        title={
          filterMode
            ? "Showing only matching lines (click to find instead)"
            : "Find matches (click to show only matching lines)"
        }
        active={filterMode}
      >
        <FilterIcon />
      </IconBtn>
      {!filterMode && (
        <>
          <IconBtn onClick={() => query && find(query, "prev")} title="Previous match (Shift+Enter)">
            <ChevronUpIcon />
          </IconBtn>
          <IconBtn onClick={() => query && find(query, "next")} title="Next match (Enter)">
            <ArrowDownIcon />
          </IconBtn>
        </>
      )}
      <IconBtn onClick={onClose} title="Close (Esc)">
        <XIcon />
      </IconBtn>
    </div>
  );
}
