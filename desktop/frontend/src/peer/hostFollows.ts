import { ListProjectTerminals } from "../../bridge/commands";
import { peerSlugOf } from "./markers";

// Hosts that keep a project's tabs for every Mac showing it: they restore the
// tabs a Mac opened there, take its renames, pins and reorders, and say when any
// of it changes. A Mac shows such a host's names and order instead of its own.
// Learned from the host's own listing, per paired machine.
const follows = new Map<string, boolean>();

export function noteHostFollows(projectName: string, follow: boolean): void {
  const slug = peerSlugOf(projectName);
  if (slug) follows.set(slug, follow);
}

export function hostFollows(projectName: string): boolean {
  const slug = peerSlugOf(projectName);
  return !!slug && follows.get(slug) === true;
}

// Asks the host when it hasn't been heard from yet. A host that can't be asked
// reads as one that doesn't follow, which keeps what a Mac did before.
export async function askHostFollows(projectName: string): Promise<boolean> {
  const slug = peerSlugOf(projectName);
  if (!slug) return false;
  const known = follows.get(slug);
  if (known !== undefined) return known;
  try {
    const listed = (await ListProjectTerminals(projectName, true)) as { follow?: unknown } | null;
    const follow = !!listed && typeof listed === "object" && listed.follow === true;
    follows.set(slug, follow);
    return follow;
  } catch {
    return false;
  }
}
