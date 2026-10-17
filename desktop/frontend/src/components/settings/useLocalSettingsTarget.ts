import { useMemo } from "react";
import { applySettingsOutsideStore } from "../../settingsEffects";
import { LOCAL_MACHINE } from "../../settingsMachine";
import { useSettingsStore, type Settings } from "../../store/settings";
import { LOCAL_COMMANDS } from "./machineCommands";
import type { SettingsTarget } from "./settingsTarget";

async function updateLocal(patch: Partial<Settings>): Promise<void> {
  await useSettingsStore.getState().update(patch);
  applySettingsOutsideStore(patch);
}

export function useLocalSettingsTarget(): SettingsTarget {
  const settings = useSettingsStore();
  return useMemo(
    () => ({ machine: LOCAL_MACHINE, settings, update: updateLocal, commands: LOCAL_COMMANDS }),
    [settings],
  );
}
