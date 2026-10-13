import { RefreshActionLabel } from "../bridge/commands";
import type { ActionInfo } from "./types";

// A `labelRefreshOnHover` button runs its label commands again as the pointer
// arrives, so the label is current by the time it's read. One request per gap:
// the backend throttles too, this only spares the round trips.
const HOVER_GAP_MS = 5_000;
const lastRefresh = new Map<string, number>();

export function refreshLabelOnHover(
  project: string,
  action: ActionInfo,
  now = Date.now(),
): boolean {
  if (!action.labelRefreshOnHover) return false;
  const key = `${project}\n${action.name}`;
  const last = lastRefresh.get(key);
  if (last !== undefined && now - last < HOVER_GAP_MS) return false;
  lastRefresh.set(key, now);
  void RefreshActionLabel(project, action.name).catch(() => {});
  return true;
}
