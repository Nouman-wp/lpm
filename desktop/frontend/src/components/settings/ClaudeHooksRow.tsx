import { useState } from "react";
import { toast } from "../../notifications/toast";
import { rowProps } from "../../settings-registry";
import { SettingsRow } from "../SettingsRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { ClaudeHooksCheck } from "./machineCommands";
import { useSettingsTarget } from "./settingsTarget";
import { Spinner } from "./Spinner";

type HooksStatus =
  | "idle"
  | "checking"
  | "installed"
  | "missing"
  | "no-settings"
  | "disabled"
  | "no-helper";

const HOOKS_DESCRIPTION: Record<HooksStatus, string> = {
  idle: "Display Claude Code running progress in sidebar",
  checking: "Checking...",
  installed: "Hooks installed correctly",
  missing: "Hooks not configured",
  "no-settings": "Claude Code settings not found",
  disabled: "Claude Code's settings turn its hooks off, so its progress can't show",
  "no-helper": "Part of lpm is missing, so Claude Code's progress can't show. Reinstall lpm",
};

function hooksStatus(check: ClaudeHooksCheck): HooksStatus {
  if (!check.settingsExists) return "no-settings";
  if (check.hooksDisabled) return "disabled";
  if (check.helperMissing) return "no-helper";
  return check.hooksInstalled ? "installed" : "missing";
}

// The hooks that let Claude Code report its progress, checked and reinstalled
// on the machine being configured.
export function ClaudeHooksRow() {
  const { commands } = useSettingsTarget();
  const [status, setStatus] = useState<HooksStatus>("idle");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const check = async () => {
    setStatus("checking");
    try {
      const next = hooksStatus(await commands.checkClaudeHooks());
      setStatus(next);
      if (next === "missing") setShowResetDialog(true);
    } catch {
      setStatus("idle");
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await commands.resetClaudeHooks();
      setStatus("installed");
      setShowResetDialog(false);
      toast.success("Claude Code hooks reinstalled");
    } catch (err) {
      toast.error(`Failed to reset hooks: ${err}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <SettingsRow {...rowProps("ai.claudeHooks", { description: HOOKS_DESCRIPTION[status] })}>
        <div className="flex items-center gap-2">
          <button onClick={check} disabled={status === "checking" || resetting} className={BTN_SECONDARY}>
            {status === "checking" ? <Spinner /> : "Check"}
          </button>
          <button onClick={reset} disabled={resetting || status === "checking"} className={BTN_SECONDARY}>
            {resetting ? <Spinner /> : "Reset"}
          </button>
        </div>
      </SettingsRow>
      <ConfirmDialog
        open={showResetDialog}
        title="Reset Claude Code hooks"
        body="Claude Code hooks are not configured correctly. Would you like to reinstall them?"
        confirmLabel="Reset"
        disabled={resetting}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={reset}
      />
    </>
  );
}
