import { ListProjectTerminals } from "../../bridge/commands";
import { peerSlugOf } from "./markers";

// Hosts that keep a project's tabs for every Mac showing it: they restore the
// tabs a Mac opened there, take its renames, pins and reorders, and say when any
// of it changes. A Mac shows such a host's names and order instead of its own.
// Learned from the host's own listing, per paired machine.
const follows = new Map<string, boolean>();
const listeners = new Set<() => void>();

function remember(slug: string, follow: boolean): void {
  if (follows.get(slug) === follow) return;
  follows.set(slug, follow);
  listeners.forEach((listener) => listener());
}

export function noteHostFollows(projectName: string, follow: boolean): void {
  const slug = peerSlugOf(projectName);
  if (slug) remember(slug, follow);
}

export function hostFollows(projectName: string): boolean {
  return knownHostFollows(projectName) === true;
}

// What the project's host said, once it has; undefined until then and for this
// Mac's own projects.
export function knownHostFollows(projectName: string): boolean | undefined {
  const slug = peerSlugOf(projectName);
  return slug ? follows.get(slug) : undefined;
}

export function subscribeHostFollows(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
    remember(slug, follow);
    return follow;
  } catch {
    return false;
  }
}
