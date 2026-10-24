import { useEffect, useRef, useState } from "react";
import { SearchFileContents } from "../../../bridge/commands";
import { toSlash, windowsRules } from "../../path";
import { SearchIcon } from "../icons";
import { parentPath } from "./treeModel";

interface ContentMatch {
  path: string;
  line: number;
  text: string;
}

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; matches: ContentMatch[]; truncated: boolean }
  | { status: "error"; message: string };

interface FilesContentSearchProps {
  root: string;
  query: string;
  onOpen: (path: string) => void;
}

const ROW =
  "flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]";

// What the filter offers when no file name matches: the files whose text does.
// A search runs on request, since a large project takes a moment to read.
export function FilesContentSearch({ root, query, onOpen }: FilesContentSearchProps) {
  const needle = query.trim();
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const seq = useRef(0);

  useEffect(() => {
    seq.current++;
    setState({ status: "idle" });
  }, [root, needle]);

  const search = async () => {
    const mine = ++seq.current;
    setState({ status: "searching" });
    try {
      const res = (await SearchFileContents(root, needle)) as { matches?: ContentMatch[]; truncated?: boolean };
      if (mine !== seq.current) return;
      const slash = windowsRules(root);
      const matches = (res?.matches ?? []).map((m) => (slash ? { ...m, path: toSlash(m.path, true) } : m));
      setState({ status: "done", matches, truncated: !!res?.truncated });
    } catch (err) {
      if (mine === seq.current) setState({ status: "error", message: String(err) });
    }
  };

  return (
    <div className="flex flex-col gap-1 px-2 py-3 text-[11px]">
      <p className="break-words px-2 pb-1 text-center text-[var(--text-muted)]">No file name matches “{needle}”</p>
      {state.status === "idle" && (
        <button
          type="button"
          onClick={() => void search()}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] [&_svg]:h-3.5 [&_svg]:w-3.5"
        >
          <SearchIcon />
          Search inside files
        </button>
      )}
      {state.status === "searching" && <p className="px-2 text-[var(--text-muted)]">Searching…</p>}
      {state.status === "error" && (
        <p className="break-words px-2 text-[var(--accent-red-text)]">Couldn't search: {state.message}</p>
      )}
      {state.status === "done" &&
        (state.matches.length === 0 ? (
          <p className="break-words px-2 text-[var(--text-muted)]">No file mentions “{needle}”</p>
        ) : (
          <>
            <p className="px-2 text-[var(--text-muted)]">
              {state.matches.length === 1 ? "1 file mentions it" : `${state.matches.length} files mention it`}
              {state.truncated && " · the first ones found"}
            </p>
            {state.matches.map((m) => (
              <button key={m.path} type="button" onClick={() => onOpen(m.path)} className={ROW}>
                <span className="truncate text-[var(--text-primary)]">
                  {m.path.slice(m.path.lastIndexOf("/") + 1)}
                  {parentPath(m.path) && <span className="text-[var(--text-muted)]"> {parentPath(m.path)}</span>}
                </span>
                <span className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                  {m.line}: {m.text}
                </span>
              </button>
            ))}
          </>
        ))}
    </div>
  );
}
