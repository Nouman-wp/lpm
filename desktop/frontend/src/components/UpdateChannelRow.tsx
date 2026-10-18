import { openReleasePage, UPDATES_INSTALL_IN_APP } from "../releasePage";
import { rowProps } from "../settings-registry";
import type { UpdateChannel } from "../store/settings";
import { checkForUpdate, useUpdateCheck } from "../store/updateCheck";
import { useSettingsTarget } from "./settings/settingsTarget";
import { SettingsRow } from "./SettingsRow";
import { SegmentedControl } from "./ui/SegmentedControl";
import type { UpdateInstall } from "./useUpdateInstall";

const OPTIONS: { value: UpdateChannel; label: string; tooltip: string }[] = [
  { value: "stable", label: "Stable", tooltip: "Tested releases" },
  { value: "beta", label: "Beta", tooltip: "New versions first. They may be less stable" },
];

// Settings › General: which releases the machine's lpm updates to, and for this
// one the way back to the newest stable release from a Beta build. A connected
// machine's updates are offered on its sidebar header, so `update` is this one's.
export function UpdateChannelRow({ update }: { update?: UpdateInstall }) {
  const { settings, update: saveSettings } = useSettingsTarget();
  const channel = settings.updateChannel ?? "stable";
  const info = useUpdateCheck((s) => s.info);

  const choose = async (next: UpdateChannel) => {
    await saveSettings({ updateChannel: next === "beta" ? next : undefined });
    if (update) checkForUpdate().catch(() => {});
  };

  const rollback = update && channel === "stable" && info?.rollbackAvail && !update.active;
  const stable = info?.stableVersion ?? "";
  const below = rollback ? (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-secondary)]">
      <span>
        {info.currentVersion} is a Beta build. The latest stable release is {stable}.
      </span>
      <button
        onClick={UPDATES_INSTALL_IN_APP ? update?.rollback : () => openReleasePage(stable)}
        className="font-medium text-[var(--accent-green-text)] hover:underline"
      >
        {UPDATES_INSTALL_IN_APP ? `Roll back to ${stable}` : `Download ${stable}`}
      </button>
    </p>
  ) : undefined;

  return (
    <SettingsRow
      {...rowProps("general.updateChannel")}
      below={below}
      details={
        <>
          <p>Stable gets a version once it has been out on Beta for a while. Beta gets each new version as soon as it’s released, so it can have rough edges.</p>
          <p>To go back, switch to Stable: lpm offers the latest stable release in place of the Beta build you’re on.</p>
        </>
      }
    >
      <SegmentedControl value={channel} onChange={(next) => void choose(next)} ariaLabel="Update channel" options={OPTIONS} />
    </SettingsRow>
  );
}
