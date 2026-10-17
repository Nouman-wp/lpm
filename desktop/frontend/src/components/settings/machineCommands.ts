import {
  CheckClaudeHooks,
  ListSystemSounds,
  PeerInvoke,
  ResetClaudeHooks,
} from "../../../bridge/commands";
import { listMonospaceFonts, mergeFontLists } from "../terminal/fontDetect";

// ClaudeHooksStatus in hooks/claude.rs.
export interface ClaudeHooksCheck {
  settingsExists: boolean;
  hooksInstalled: boolean;
  hooksDisabled: boolean;
  helperMissing: boolean;
}

// What Settings rows run on the machine they configure.
export interface MachineCommands {
  listSystemSounds: () => Promise<string[]>;
  listMonospaceFonts: () => Promise<string[]>;
  checkClaudeHooks: () => Promise<ClaudeHooksCheck>;
  resetClaudeHooks: () => Promise<void>;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export const LOCAL_COMMANDS: MachineCommands = {
  listSystemSounds: () => ListSystemSounds().then(strings),
  listMonospaceFonts,
  checkClaudeHooks: () => CheckClaudeHooks(),
  resetClaudeHooks: () => ResetClaudeHooks(),
};

// A connected machine's fonts are only the ones it lists: the probe that finds
// fonts a backend misses measures this machine's.
export function peerCommands(slug: string): MachineCommands {
  const run = (cmd: string) => PeerInvoke(slug, cmd, {});
  return {
    listSystemSounds: () => run("list_system_sounds").then(strings),
    listMonospaceFonts: () =>
      run("list_monospace_fonts").then((fonts) => mergeFontLists(strings(fonts), [])),
    checkClaudeHooks: () => run("check_claude_hooks"),
    resetClaudeHooks: () => run("reset_claude_hooks").then(() => undefined),
  };
}
