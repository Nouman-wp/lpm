import { UPDATES_INSTALL_IN_APP } from "../../releasePage";
import { SettingsSection } from "../SettingsSection";
import { UpdateChannelRow } from "../UpdateChannelRow";
import { useUpdateInstall } from "../useUpdateInstall";
import { IdleUpdateRow } from "./IdleUpdateRow";
import { ServicesBuildNotice } from "./ServicesBuildNotice";
import { UpdateStatusRow } from "./UpdateStatusRow";

// Settings › General: everything about this Mac's lpm version in one card —
// what runs, what's next, how it updates, and services left on an older one.
export function UpdatesSection({ version }: { version: string }) {
  const update = useUpdateInstall();
  return (
    <>
      {update.dialogs}
      <SettingsSection title="Updates">
        <UpdateStatusRow version={version} update={update} />
        {version !== "dev" && <UpdateChannelRow update={update} />}
        {version !== "dev" && UPDATES_INSTALL_IN_APP && <IdleUpdateRow />}
        <ServicesBuildNotice appVersion={version} />
      </SettingsSection>
    </>
  );
}
