import { main } from "../../bridge/models";
import { branchSlug } from "../newBranchHints";
import { branchKey } from "./branchUtils";

export type BranchEntry =
  | { kind: "create"; slug: string }
  | { kind: "branch"; branch: main.Branch };

export interface BranchSearchRows {
  // Everything ↑/↓ moves through, in the order shown.
  entries: BranchEntry[];
  local: main.Branch[];
  remote: main.Branch[];
  // Where the highlight starts: the first branch, or the create row when it
  // is all there is.
  initialIndex: number;
}

// The name the create row would make, unless the query already names a branch.
export function createSlug(query: string, known: main.Branch[]): string | null {
  const q = query.trim();
  const slug = branchSlug(q);
  if (!slug) return null;
  const exact = known.some((b) => b.name === q || b.name === slug || branchKey(b) === q);
  return exact ? null : slug;
}

export function branchSearchRows(
  query: string,
  shown: main.Branch[],
  known: main.Branch[],
): BranchSearchRows {
  const slug = createSlug(query, [...shown, ...known]);
  const local = shown.filter((b) => !b.remote);
  const remote = shown.filter((b) => !!b.remote);
  const entries: BranchEntry[] = [
    ...(slug ? [{ kind: "create" as const, slug }] : []),
    ...[...local, ...remote].map((branch) => ({ kind: "branch" as const, branch })),
  ];
  return { entries, local, remote, initialIndex: slug && shown.length > 0 ? 1 : 0 };
}
