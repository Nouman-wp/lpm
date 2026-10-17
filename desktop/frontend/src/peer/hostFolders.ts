import { PeerInvoke } from "../../bridge/commands";
import type { ProjectGroup } from "../types";
import { parsePeerMarker, prefixName } from "./markers";

// A paired machine's own sidebar folders, as its sidebar lays them out. They are
// the host's — its window, its phones and every Mac showing its projects share
// one layout — so this Mac shows them as they are and changes them one op at a
// time (hostfolders.rs). Only collapsing a folder stays here: what one viewer
// folds away is nobody else's business.
export interface HostFolders {
  /// Top-level slots: peer-marked project names and "group:<id>" tokens.
  order: string[];
  /// Folders, their members peer-marked; `collapsed` is never set.
  groups: ProjectGroup[];
}

export type HostFolderOp =
  | { op: "create"; name: string; members?: string[]; before?: string | null }
  | { op: "rename"; id: string; name: string }
  | { op: "ungroup"; id: string }
  | { op: "move"; item: string; folder: string | null; before: string | null }
  | { op: "copies"; order: string[] };

const READ_CMD = "host_folders";
const EDIT_CMD = "host_folders_edit";
const GROUP_PREFIX = "group:";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function marked(slug: string, token: string): string {
  return token.startsWith(GROUP_PREFIX) ? token : prefixName(slug, token);
}

// The host's names, as this Mac lists its projects.
export function translateHostFolders(slug: string, raw: unknown): HostFolders {
  const value = (raw ?? {}) as { order?: unknown; groups?: unknown };
  const groups: ProjectGroup[] = [];
  for (const entry of Array.isArray(value.groups) ? value.groups : []) {
    const g = entry as Partial<ProjectGroup> | null;
    if (!g || typeof g.id !== "string" || !g.id) continue;
    groups.push({
      id: g.id,
      name: typeof g.name === "string" ? g.name : "",
      members: strings(g.members).map((name) => prefixName(slug, name)),
    });
  }
  return { order: strings(value.order).map((token) => marked(slug, token)), groups };
}

// What the host calls a project or folder token this Mac holds marked.
function hostToken(token: string): string {
  if (token.startsWith(GROUP_PREFIX)) return token;
  const marker = parsePeerMarker(token);
  return marker?.kind === "name" ? marker.raw : token;
}

export function hostOp(op: HostFolderOp): HostFolderOp {
  switch (op.op) {
    case "create":
      return {
        ...op,
        members: op.members?.map(hostToken),
        before: op.before ? hostToken(op.before) : op.before,
      };
    case "move":
      return { ...op, item: hostToken(op.item), before: op.before ? hostToken(op.before) : null };
    case "copies":
      return { ...op, order: op.order.map(hostToken) };
    default:
      return op;
  }
}

export async function readHostFolders(slug: string): Promise<HostFolders> {
  return translateHostFolders(slug, await PeerInvoke(slug, READ_CMD, {}));
}

export async function editHostFolders(slug: string, op: HostFolderOp): Promise<HostFolders> {
  return translateHostFolders(slug, await PeerInvoke(slug, EDIT_CMD, hostOp(op)));
}

export function groupOf(folders: HostFolders, name: string): ProjectGroup | undefined {
  return folders.groups.find((g) => g.members.includes(name));
}

// The top-level slot a project holds: its own, or that of the folder it is in.
// A folder made for it goes there, rather than at the end of the list.
export function slotOf(folders: HostFolders, name: string): string | null {
  if (folders.order.includes(name)) return name;
  const group = groupOf(folders, name);
  return group ? `${GROUP_PREFIX}${group.id}` : null;
}

// Where a project lands when it leaves `group`: the slot just below the folder.
export function slotAfterFolder(folders: HostFolders, groupId: string): string | null {
  const at = folders.order.indexOf(`${GROUP_PREFIX}${groupId}`);
  return at >= 0 ? (folders.order[at + 1] ?? null) : null;
}

// The move a drag of `active` onto `over` makes, where `ids` is every row in the
// order the section renders them: below `over` when dragged downward, above it
// when dragged upward, in whichever folder (or none) `over` sits.
export function dropMove(
  folders: HostFolders,
  ids: string[],
  active: string,
  over: string,
): HostFolderOp | null {
  if (active === over) return null;
  const from = ids.indexOf(active);
  const to = ids.indexOf(over);
  if (from < 0 || to < 0) return null;
  const group = groupOf(folders, over);
  const list = group ? group.members : folders.order;
  // A project the host hasn't slotted yet renders last, where a missing anchor
  // puts it too.
  const at = list.indexOf(over);
  const below = at < 0 ? null : (list.slice(at + 1).find((token) => token !== active) ?? null);
  return {
    op: "move",
    item: active,
    folder: group?.id ?? null,
    before: from < to ? below : over,
  };
}
