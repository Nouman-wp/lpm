import { useEffect, useState } from "react";
import { BrowserOpenURL } from "../../../bridge/runtime";
import { isMac } from "../../platform";
import { rowProps } from "../../settings-registry";
import { useAccountsStore } from "../../store/accounts";
import type { View } from "../../store/app";
import { ClaudeAccountsSection } from "../ClaudeAccountsSection";
import { statuslineSelectionLabel } from "../ClaudeStatusLineView";
import { codexStatuslineSelectionLabel } from "../CodexStatusLineView";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";
import { onStatusLineChanged } from "../statusLineChanges";
import { StatusLineRowPreview } from "../StatusLineRowPreview";
import { BTN_SECONDARY } from "../ui/buttons";
import { useRowReach, useSettingsTarget } from "./settingsTarget";
import { useClaudeAccountsSource } from "./useClaudeAccountsSource";

export function AiPane({ onNavigate }: { onNavigate: (view: View) => void }) {
  const shows = useRowReach();
  const { machine, commands } = useSettingsTarget();
  const { statusLine } = commands;
  const accounts = useClaudeAccountsSource(machine.kind === "peer" ? machine.slug : null);
  const refreshAccountStatuses = useAccountsStore((s) => s.refreshStatuses);
  const [statuslineDescription, setStatuslineDescription] = useState("Choose what the status line under Claude Code shows");
  const [codexStatuslineDescription, setCodexStatuslineDescription] = useState(
    "Choose what the status line under Codex shows",
  );

  useEffect(() => {
    void refreshAccountStatuses();
  }, [refreshAccountStatuses]);

  useEffect(() => {
    const loadClaude = () =>
      statusLine.claudeState()
        .then((s) => setStatuslineDescription(statuslineSelectionLabel(s?.selected ?? "current", Boolean(s?.hasCustom))))
        .catch(() => {});
    const loadCodex = () =>
      statusLine.codexState()
        .then((state) =>
          setCodexStatuslineDescription(
            codexStatuslineSelectionLabel(
              Array.isArray(state?.items) ? state.items : [],
              Boolean(state?.configured),
            ),
          ),
        )
        .catch(() => {});
    void loadClaude();
    void loadCodex();
    return onStatusLineChanged((agent) => {
      void (agent === "claude" ? loadClaude() : loadCodex());
    });
  }, [statusLine]);

  return (
    <>
      <SettingsSection>
        <SettingsRow {...rowProps("ai.commitInstructions")}>
          <button onClick={() => onNavigate("commit-instructions")} className={BTN_SECONDARY}>Edit</button>
        </SettingsRow>
        <SettingsRow {...rowProps("ai.prInstructions")}>
          <button onClick={() => onNavigate("pr-instructions")} className={BTN_SECONDARY}>Edit</button>
        </SettingsRow>
        <SettingsRow {...rowProps("ai.branchInstructions")}>
          <button onClick={() => onNavigate("branch-instructions")} className={BTN_SECONDARY}>Edit</button>
        </SettingsRow>
        {isMac && shows("ai.voiceToText") && (
          <SettingsRow {...rowProps("ai.voiceToText")}>
            <button onClick={() => BrowserOpenURL("https://voicetotext.cc")} className={BTN_SECONDARY}>Learn more</button>
          </SettingsRow>
        )}
      </SettingsSection>

      {shows("ai.accounts") && accounts && <ClaudeAccountsSection source={accounts} />}

      {shows("ai.statusLine") && (
        <SettingsSection>
          <SettingsRow
            {...rowProps("ai.statusLine", { description: statuslineDescription })}
            below={<StatusLineRowPreview agent="claude" statusLine={statusLine} />}
          >
            <button onClick={() => onNavigate("claude-statusline")} className={BTN_SECONDARY}>
              Customize
            </button>
          </SettingsRow>
          <SettingsRow
            {...rowProps("ai.codexStatusLine", { description: codexStatuslineDescription })}
            below={<StatusLineRowPreview agent="codex" statusLine={statusLine} />}
          >
            <button onClick={() => onNavigate("codex-statusline")} className={BTN_SECONDARY}>
              Customize
            </button>
          </SettingsRow>
        </SettingsSection>
      )}
    </>
  );
}
