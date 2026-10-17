import { createContext, useContext } from "react";
import { rowReaches, type SettingsRowId } from "../../settings-registry";
import type { SettingsMachine } from "../../settingsMachine";
import type { Settings } from "../../store/settings";
import type { MachineCommands } from "./machineCommands";

// What the Settings view reads and changes: one machine's settings, and the
// commands its rows run there.
export interface SettingsTarget {
  machine: SettingsMachine;
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  commands: MachineCommands;
}

export const SettingsTargetContext = createContext<SettingsTarget | null>(null);

export function useSettingsTarget(): SettingsTarget {
  const target = useContext(SettingsTargetContext);
  if (!target) throw new Error("useSettingsTarget needs a SettingsTargetContext provider");
  return target;
}

// Whether a Settings row is there on the machine being configured.
export function useRowReach(): (id: SettingsRowId) => boolean {
  const { machine } = useSettingsTarget();
  return (id) => rowReaches(id, machine);
}
