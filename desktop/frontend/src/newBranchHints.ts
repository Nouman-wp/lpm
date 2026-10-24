import type { main } from "../bridge/models";
import { slugify } from "./slugify";

// The name a typed branch name is created under; submit uses the same.
export const branchSlug = (name: string) => slugify(name, { allowSlash: true });

// How the branch a new one starts from stands against origin, as of the last
// fetch. Null when it tracks nothing.
export function upstreamNote(status: Pick<main.GitStatus, "hasUpstream" | "ahead" | "behind">): string | null {
  if (!status.hasUpstream) return null;
  const { ahead, behind } = status;
  if (ahead > 0 && behind > 0) return `${ahead} ahead, ${behind} behind origin`;
  if (ahead > 0) return `${ahead} ahead of origin`;
  if (behind > 0) return `${behind} behind origin`;
  return "up to date with origin";
}

export function uncommittedNote(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "1 uncommitted file comes with you."
    : `${count} uncommitted files come with you.`;
}

// The branch a new name would collide with: a local one, else one only on a remote.
export function existingBranch(slug: string, lists: (main.Branch[] | null)[]): main.Branch | null {
  if (!slug) return null;
  const matches = lists.flatMap((list) => list ?? []).filter((b) => b.name === slug);
  return matches.find((b) => !b.remote) ?? matches[0] ?? null;
}
