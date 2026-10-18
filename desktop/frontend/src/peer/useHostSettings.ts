import { useEffect, useState } from "react";
import { PeerSettingsGet } from "../../bridge/commands";
import { settingsFromFile, type Settings } from "../store/settings";

// A paired machine's own settings, as far as it shares them (peersettings.rs).
// Null without a machine, while they load, and from one that doesn't share them.
export function useHostSettings(slug: string | null): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    setSettings(null);
    if (!slug) return;
    let cancelled = false;
    PeerSettingsGet(slug)
      .then((value) => {
        if (!cancelled) setSettings(settingsFromFile(value));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return settings;
}
