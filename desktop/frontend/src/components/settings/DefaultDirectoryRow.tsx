import { useState } from "react";
import { BrowseFolder } from "../../../bridge/commands";
import { rowProps } from "../../settings-registry";
import { RemoteFolderBrowserModal } from "../RemoteFolderBrowserModal";
import { SettingsRow } from "../SettingsRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { useSettingsTarget } from "./settingsTarget";

// Where new projects go on the machine being configured: picked with this
// machine's own folder dialog, or by browsing a connected one's folders.
export function DefaultDirectoryRow() {
  const { machine, settings, update } = useSettingsTarget();
  const [browsing, setBrowsing] = useState(false);
  const directory = settings.defaultProjectDirectory;

  const choose = async () => {
    if (machine.kind === "peer") {
      setBrowsing(true);
      return;
    }
    try {
      const dir = await BrowseFolder(directory);
      if (dir) void update({ defaultProjectDirectory: dir });
    } catch {
      // The user's own picker; cancelling it is normal.
    }
  };

  return (
    <>
      <SettingsRow
        {...rowProps("general.defaultDir")}
        below={
          <p
            className={`mt-1 break-all font-mono text-[11px] ${
              directory ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
            }`}
          >
            {directory || "Not set"}
          </p>
        }
      >
        <div className="flex items-center gap-2">
          {directory && (
            <button
              onClick={() => void update({ defaultProjectDirectory: undefined })}
              className={BTN_SECONDARY}
            >
              Clear
            </button>
          )}
          <button onClick={() => void choose()} className={BTN_SECONDARY}>
            {directory ? "Change…" : "Choose…"}
          </button>
        </div>
      </SettingsRow>
      {machine.kind === "peer" && (
        <RemoteFolderBrowserModal
          open={browsing}
          slug={machine.slug}
          alias={machine.name}
          title="Default project directory"
          confirmLabel="Choose"
          onChoose={(path) => {
            setBrowsing(false);
            void update({ defaultProjectDirectory: path });
          }}
          onClose={() => setBrowsing(false)}
        />
      )}
    </>
  );
}
