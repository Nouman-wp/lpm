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
      <SettingsRow {...rowProps("general.defaultDir")}>
        <div className="flex items-center gap-2">
          <span
            className="max-w-[180px] truncate font-mono text-xs text-[var(--text-muted)]"
            title={directory || undefined}
          >
            {directory || "Not set"}
          </span>
          {directory && (
            <button
              onClick={() => void update({ defaultProjectDirectory: undefined })}
              className={BTN_SECONDARY}
            >
              Clear
            </button>
          )}
          <button onClick={() => void choose()} className={BTN_SECONDARY}>
            Choose
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
