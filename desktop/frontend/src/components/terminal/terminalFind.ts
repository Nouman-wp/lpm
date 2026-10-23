import type { SearchAddon } from "@xterm/addon-search";

export const MATCH_DECORATIONS = {
  matchBackground: "#5c4a00",
  matchBorder: "#7a6400",
  matchOverviewRuler: "#7a6400",
  activeMatchBackground: "#9e6a03",
  activeMatchBorder: "#c98a08",
  activeMatchColorOverviewRuler: "#c98a08",
};

// The search add-on's default highlight limit; it stops counting there too.
const FIND_RESULT_LIMIT = 1000;

export type FindDirection = "next" | "prev";

export interface FindOptions {
  caseSensitive: boolean;
  regex: boolean;
}

export interface FindResults {
  index: number;
  count: number;
}

export type FindOutcome = "found" | "none" | "invalid";

const lastOptions = new WeakMap<SearchAddon, string>();

// Highlighting every match is what makes the add-on report how many there are.
export function runFind(
  search: SearchAddon | null | undefined,
  query: string,
  direction: FindDirection,
  options: FindOptions,
): FindOutcome {
  if (!search) return "none";
  // The add-on records new options before comparing them with the last ones, so
  // turning on match case alone would keep the old highlights and count.
  const optionsKey = `${options.caseSensitive}:${options.regex}`;
  if (lastOptions.has(search) && lastOptions.get(search) !== optionsKey) search.clearDecorations();
  lastOptions.set(search, optionsKey);
  const searchOptions = { ...options, decorations: MATCH_DECORATIONS };
  try {
    const found =
      direction === "next"
        ? search.findNext(query, searchOptions)
        : search.findPrevious(query, searchOptions);
    return found ? "found" : "none";
  } catch {
    // An unfinished regular expression such as "a(" throws inside the add-on.
    search.clearDecorations();
    return "invalid";
  }
}

export function watchFindResults(
  search: SearchAddon | null | undefined,
  onResults: (results: FindResults) => void,
): () => void {
  if (!search) return () => {};
  const subscription = search.onDidChangeResults(({ resultIndex, resultCount }) =>
    onResults({ index: resultIndex, count: resultCount }),
  );
  return () => subscription.dispose();
}

export function findResultsLabel({ index, count }: FindResults): string {
  if (count === 0) return "No matches";
  const total = count >= FIND_RESULT_LIMIT ? `${FIND_RESULT_LIMIT}+` : String(count);
  if (index >= 0) return `${index + 1} of ${total}`;
  return `${total} ${count === 1 ? "match" : "matches"}`;
}
