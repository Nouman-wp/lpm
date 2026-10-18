import { isPeerName } from "./peer/markers";
import type { ZoneInfo } from "./types";

// A peer project's global zones are out of reach: a global edit would land in
// this Mac's global.yml.
export function isZoneEditable(projectName: string, zone: Pick<ZoneInfo, "source">): boolean {
  return !isPeerName(projectName) || zone.source !== "global";
}
