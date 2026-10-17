import { rowProps } from "../../settings-registry";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";

// A connected machine's lpm. Updating it is offered on its sidebar header, where
// its progress shows too.
export function PeerAboutSection({ version }: { version: string }) {
  return (
    <SettingsSection title="About">
      <SettingsRow {...rowProps("general.version")}>
        <span className="text-xs text-[var(--text-muted)]">{version || "Unknown"}</span>
      </SettingsRow>
    </SettingsSection>
  );
}
