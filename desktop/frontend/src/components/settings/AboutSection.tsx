import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GetVersion, UninstallApp } from "../../../bridge/commands";
import { MACHINE } from "../../machineWords";
import { isMac } from "../../platform";
import { openReleasePage, UPDATES_INSTALL_IN_APP } from "../../releasePage";
import { removeAppConfirmText } from "../../removeAppCopy";
import { rowProps } from "../../settings-registry";
import { checkForUpdate, useUpdateCheck } from "../../store/updateCheck";
import type { UpdateInstallState } from "../../store/updateInstall";
import { AgentToolsManualSetup } from "../AgentToolsManualSetup";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";
import { SkillInstallControl } from "../SkillInstallControl";
import { UpdateChannelRow } from "../UpdateChannelRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useUpdateInstall } from "../useUpdateInstall";
import { RemovingOverlay } from "./RemovingOverlay";
import { Spinner } from "./Spinner";

type UpdateStatus = "idle" | "checking" | "available" | "up-to-date" | "installing" | "error";

function getUpdateDescription(
  status: UpdateStatus,
  latestVersion: string,
  error: string,
): string {
  switch (status) {
    case "checking":
      return "Checking...";
    case "available":
      return `v${latestVersion} available`;
    case "up-to-date":
      return "You're up to date";
    case "error":
      return error || "Failed to check";
    default:
      return "Check for new versions";
  }
}

function installDescription({ phase, progress, cancelling }: UpdateInstallState): string {
  if (cancelling) return "Cancelling update...";
  if (phase === "installing") return "Installing. lpm restarts in a moment.";
  return phase === "downloading" && progress >= 0 ? `Downloading... ${progress}%` : "Downloading...";
}

// This machine's lpm: its version, its updates, its agent tools and removing it.
export function AboutSection() {
  const [version, setVersion] = useState("");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "checked" | "error">("idle");
  const checkedUpdate = useUpdateCheck((s) => s.info);
  const latestVersion = checkedUpdate?.latestVersion ?? "";
  const [updateError, setUpdateError] = useState("");
  const [showRemoveApp, setShowRemoveApp] = useState(false);
  const [removeAppData, setRemoveAppData] = useState(false);
  const [removingApp, setRemovingApp] = useState(false);

  useEffect(() => {
    GetVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (showRemoveApp) setRemoveAppData(false);
  }, [showRemoveApp]);

  const update = useUpdateInstall();
  // An update any check found is offered here too; "up to date" only once
  // this page has asked.
  const updateStatus: UpdateStatus =
    checkState === "checking" || checkState === "error"
      ? checkState
      : checkedUpdate?.updateAvail
        ? "available"
        : checkState === "checked"
          ? "up-to-date"
          : "idle";
  const shownUpdateStatus: UpdateStatus = update.active ? "installing" : update.error ? "error" : updateStatus;

  const handleCheckUpdate = async () => {
    setCheckState("checking");
    setUpdateError("");
    update.dismissError();
    try {
      await checkForUpdate();
      setCheckState("checked");
    } catch (err) {
      setCheckState("error");
      setUpdateError(String(err));
    }
  };

  const handleRemoveApp = async () => {
    setShowRemoveApp(false);
    setRemovingApp(true);
    try {
      await UninstallApp(removeAppData);
      // The app quits itself once removal is scheduled; the overlay stays up.
    } catch (err) {
      setRemovingApp(false);
      // Off macOS the app stays installed, so the backend always answers with
      // where to finish rather than quitting.
      if (isMac) toast.error(String(err));
      else toast.info(String(err), { duration: 15_000 });
    }
  };

  return (
    <>
      {update.dialogs}
      {removingApp && <RemovingOverlay />}

      <SettingsSection title="About">
        <SettingsRow {...rowProps("general.version")}>
          <span className="text-xs text-[var(--text-muted)]">{version || "..."}</span>
        </SettingsRow>
        <SettingsRow
          {...rowProps("general.updates", {
            description:
              version === "dev"
                ? "Not available in development builds"
                : update.active
                  ? installDescription(update)
                  : getUpdateDescription(shownUpdateStatus, latestVersion, update.error || updateError),
          })}
        >
          {version === "dev" ? null : update.active ? (
            <button
              onClick={update.cancel}
              disabled={update.cancelling || update.phase === "installing"}
              className={BTN_SECONDARY}
            >
              {update.phase === "installing" ? <Spinner /> : "Cancel"}
            </button>
          ) : shownUpdateStatus === "available" ? (
            <button onClick={UPDATES_INSTALL_IN_APP ? update.request : () => openReleasePage(latestVersion)} className="rounded-md bg-[var(--accent-green)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
              {UPDATES_INSTALL_IN_APP ? "Update" : "Download"}
            </button>
          ) : (
            <button onClick={handleCheckUpdate} disabled={shownUpdateStatus === "checking"} className={BTN_SECONDARY}>
              {shownUpdateStatus === "checking" ? <Spinner /> : "Check"}
            </button>
          )}
        </SettingsRow>
        {version !== "dev" && <UpdateChannelRow update={update} />}
        <SettingsRow
          {...rowProps("general.agentTools")}
          details={
            <>
              <p>Skills teach AI coding agents how lpm works. Claude Code, Codex, Gemini CLI, and OpenCode pick them up automatically.</p>
              <p>Agents learn to create and edit project configurations and to start, stop, and duplicate projects on your behalf.</p>
              <p>The lpm command line tool is also installed, so agents — and you — can control projects from any terminal.</p>
              <AgentToolsManualSetup />
            </>
          }
        >
          <SkillInstallControl />
        </SettingsRow>
        <SettingsRow {...rowProps("general.removeApp")}>
          <button
            onClick={() => setShowRemoveApp(true)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--accent-red)] transition-colors hover:bg-[var(--bg-active)]"
          >
            Remove
          </button>
        </SettingsRow>
      </SettingsSection>

      <ConfirmDialog
        open={showRemoveApp}
        title="Remove lpm"
        variant="destructive"
        confirmLabel="Remove"
        body={
          isMac ? (
            <>
              <p>
                The app, its command line tool, and its agent skills will be
                removed from {MACHINE.thisMachine}. Your project folders won't be touched.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={removeAppData}
                  onChange={(e) => setRemoveAppData(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also delete settings and project configurations
                  <span className="block text-[11px] text-[var(--text-muted)]">
                    Removes every lpm setting, note, and project configuration.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <p>{removeAppConfirmText()}</p>
          )
        }
        onCancel={() => setShowRemoveApp(false)}
        onConfirm={handleRemoveApp}
      />
    </>
  );
}
