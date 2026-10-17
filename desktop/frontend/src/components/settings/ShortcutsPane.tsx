import { configuredHotkeyCombos, HOTKEYS, resolveHotkey } from "../../hotkeys";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";
import { BTN_SECONDARY } from "../ui/buttons";
import { ShortcutRecorder } from "../ui/ShortcutRecorder";
import { useSettingsTarget } from "./settingsTarget";

export function ShortcutsPane() {
  const { settings, update } = useSettingsTarget();
  const hotkeys = settings.hotkeys;

  return (
    <SettingsSection>
      {HOTKEYS.map((def) => {
        const value = resolveHotkey(hotkeys, def.id);
        const isDefault = value === def.default;
        return (
          <SettingsRow
            key={def.id}
            id={`shortcut.${def.id}`}
            label={def.label}
            description={def.description}
          >
            <div className="flex items-start gap-2">
              {!isDefault && (
                <button
                  onClick={() => void update({ hotkeys: { ...hotkeys, [def.id]: def.default } })}
                  className={BTN_SECONDARY}
                >
                  Reset
                </button>
              )}
              <ShortcutRecorder
                value={value}
                onChange={(next) => void update({ hotkeys: { ...hotkeys, [def.id]: next } })}
                reserved={configuredHotkeyCombos(hotkeys, def.id)}
              />
            </div>
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );
}
