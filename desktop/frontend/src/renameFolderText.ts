import { folderName } from "./path";
import { isWindows } from "./platform";
import { count } from "./count";

// What keeps a project's folder from moving: its running services and its
// open terminals, which work inside it.
export interface FolderMoveBlock {
  running: boolean;
  terminals: number;
}

export const isFolderMoveBlocked = (block: FolderMoveBlock) =>
  block.running || block.terminals > 0;

const closeText = (n: number) =>
  n === 1 ? "It closes before the folder moves." : "They close before the folder moves.";

export function folderMoveNotice({ running, terminals }: FolderMoveBlock): string | null {
  if (running && terminals > 0) return `Running with ${count(terminals, "terminal", "terminals")}. ${closeText(terminals)}`;
  if (running) return "Running. It stops before the folder moves.";
  if (terminals > 0) return `${count(terminals, "terminal", "terminals")} open. ${closeText(terminals)}`;
  return null;
}

export function folderMoveAction({ running, terminals }: FolderMoveBlock): string {
  if (running && terminals > 0) return "Stop & close";
  if (running) return "Stop";
  return terminals === 1 ? "Close terminal" : "Close terminals";
}

export function folderMoveError(err: unknown): string {
  const message = String(err).replace(/^Error:\s*/, "").trim();
  return `Couldn't move the folder: ${message}`;
}

// The destination split so its last name, the part being renamed, can stand out.
export function folderMoveTarget(next: string, win = isWindows): { dir: string; name: string } {
  const trimmed = next.replace(win ? /[\\/]+$/ : /\/+$/, "");
  const name = folderName(trimmed, win);
  return { dir: trimmed.slice(0, trimmed.length - name.length), name };
}
