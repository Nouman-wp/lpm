import { normalizeAutoPullMode, type AutoPullMode } from "../autoPull";
import { peerSlugOf } from "../peer/markers";
import { useHostSettings } from "../peer/useHostSettings";
import { useSettingsStore } from "../store/settings";

// The Settings auto pull mode a project goes by: this Mac's, or for a paired
// machine's project that machine's own, since it does the pulling. Null while a
// machine's is loading, or when it doesn't share it.
export function useAutoPullMode(projectName: string): AutoPullMode | null {
  const local = useSettingsStore((s) => normalizeAutoPullMode(s.autoPull));
  const slug = peerSlugOf(projectName);
  const host = useHostSettings(slug);
  if (!slug) return local;
  return host ? normalizeAutoPullMode(host.autoPull) : null;
}
