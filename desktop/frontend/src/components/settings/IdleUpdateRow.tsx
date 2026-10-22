import { rowProps } from "../../settings-registry";
import { useSettingsStore } from "../../store/settings";
import { SettingsRow } from "../SettingsRow";
import { Toggle } from "../ui/Toggle";

// Settings › General › About: this Mac installs its own updates while nobody
// is using it. Off unless chosen, since the install restarts lpm.
export function IdleUpdateRow() {
  const enabled = useSettingsStore((s) => s.installUpdatesWhenIdle ?? false);
  const update = useSettingsStore((s) => s.update);
  return (
    <SettingsRow
      {...rowProps("general.idleUpdates")}
      details={
        <>
          <p>
            lpm looks for a new version every hour. It installs one once nobody has used this Mac
            for 10 minutes, no agent is working or waiting for you, no action is running, and every
            terminal is back at its prompt.
          </p>
          <p>Installing restarts lpm. Agents reopen in their conversations and services keep running.</p>
        </>
      }
    >
      <Toggle
        aria-label="Install updates when idle"
        enabled={enabled}
        onChange={(v) => void update({ installUpdatesWhenIdle: v || undefined })}
      />
    </SettingsRow>
  );
}
