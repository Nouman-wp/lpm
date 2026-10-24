import type { SettingsSearchEntry } from "../settings-registry";
import type { SearchGroup } from "../settingsSearchHits";
import { SettingsSearchResult } from "./SettingsSearchResult";

interface SettingsSearchResultsProps {
  groups: SearchGroup[];
  query: string;
  hints: string[];
  selectedIndex: number;
  onActivate: (entry: SettingsSearchEntry) => void;
  onHover: (index: number) => void;
  onHint: (hint: string) => void;
}

export function SettingsSearchResults({
  groups,
  query,
  hints,
  selectedIndex,
  onActivate,
  onHover,
  onHint,
}: SettingsSearchResultsProps) {
  if (groups.length === 0) {
    return (
      <div className="px-2.5 py-3 text-xs">
        <p className="text-[var(--text-secondary)]">No matches for “{query.trim()}”.</p>
        {hints.length > 0 && (
          <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
            Try{" "}
            {hints.map((hint, i) => (
              <span key={hint}>
                {i > 0 && ", "}
                <button
                  type="button"
                  onClick={() => onHint(hint)}
                  className="text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                >
                  “{hint}”
                </button>
              </span>
            ))}
            …
          </p>
        )}
      </div>
    );
  }
  const starts = groups.map((_, g) => groups.slice(0, g).reduce((n, prev) => n + prev.hits.length, 0));
  return (
    <div className="flex flex-col">
      {groups.map((group, g) => (
        <div key={group.page} className="mb-1">
          <div className="mb-0.5 mt-2 px-2.5 text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--text-muted)] opacity-70">
            {group.page}
          </div>
          {group.hits.map((hit, i) => {
            const at = starts[g] + i;
            return (
              <SettingsSearchResult
                key={hit.entry.id}
                hit={hit}
                query={query}
                active={at === selectedIndex}
                onActivate={() => onActivate(hit.entry)}
                onHover={() => onHover(at)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
