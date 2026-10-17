import { basename } from "./path";
import { parsePeerMarker, prefixName } from "./peer/markers";

// Whose memory folder `dir` is — the project itself, or the original it is a
// copy of — by the name this Mac calls that project. A paired machine's folder
// carries that machine's name for it.
export function memoryOwner(projectName: string, dir: string): string {
  const owner = basename(dir);
  const marker = parsePeerMarker(projectName);
  return owner && marker?.kind === "name" ? prefixName(marker.slug, owner) : owner;
}
