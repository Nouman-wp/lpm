import {
  ApplyClaudeStatusline,
  ApplyClaudeStatuslineCustom,
  ApplyCodexStatusline,
  ClaudeStatuslinePresetSpec,
  GetClaudeStatuslineState,
  GetCodexStatuslineState,
  PreviewClaudeStatusline,
  ResetCodexStatusline,
} from "../../../bridge/commands";
import type { MachineRun } from "./machineCommands";

// The Claude Code and Codex status lines a machine shows under its agents
// (claude_statusline, codex_statusline.rs).
export interface StatusLineCommands {
  claudeState: () => Promise<any>;
  applyClaude: (template: string) => Promise<void>;
  applyClaudeCustom: (spec: unknown) => Promise<void>;
  claudePresetSpec: (id: string) => Promise<unknown>;
  previewClaude: (selection: unknown) => Promise<string>;
  codexState: () => Promise<any>;
  applyCodex: (items: string[], useColors: boolean) => Promise<void>;
  resetCodex: () => Promise<void>;
}

export const LOCAL_STATUS_LINE: StatusLineCommands = {
  claudeState: () => GetClaudeStatuslineState(),
  applyClaude: (template) => ApplyClaudeStatusline(template),
  applyClaudeCustom: (spec) => ApplyClaudeStatuslineCustom(spec),
  claudePresetSpec: (id) => ClaudeStatuslinePresetSpec(id),
  previewClaude: (selection) => PreviewClaudeStatusline(selection),
  codexState: () => GetCodexStatuslineState(),
  applyCodex: (items, useColors) => ApplyCodexStatusline(items, useColors),
  resetCodex: () => ResetCodexStatusline(),
};

export function peerStatusLine(run: MachineRun): StatusLineCommands {
  return {
    claudeState: () => run("get_claude_statusline_state"),
    applyClaude: (template) => run("apply_claude_statusline", { template }),
    applyClaudeCustom: (spec) => run("apply_claude_statusline_custom", { spec }),
    claudePresetSpec: (id) => run("claude_statusline_preset_spec", { id }),
    previewClaude: (selection) => run("preview_claude_statusline", { selection }),
    codexState: () => run("get_codex_statusline_state"),
    applyCodex: (items, useColors) => run("apply_codex_statusline", { items, useColors }),
    resetCodex: () => run("reset_codex_statusline"),
  };
}
