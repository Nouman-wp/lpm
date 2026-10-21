import { BrowserOpenURL } from "../../../bridge/runtime";
import { sendToRequestUrl } from "../../githubIssue";
import { rowProps, SOUND_EVENTS } from "../../settings-registry";
import type { Settings } from "../../store/settings";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";
import { SoundPicker } from "../SoundPicker";
import { TelegramRow } from "../TelegramRow";
import { BTN_SECONDARY } from "../ui/buttons";
import { Toggle } from "../ui/Toggle";
import { useRowReach, useSettingsTarget } from "./settingsTarget";
import { useMachineList } from "./useMachineList";

type SoundEvent = (typeof SOUND_EVENTS)[number]["event"];

// Where each event's sound is kept.
const SOUND_SETTINGS: Record<
  SoundEvent,
  { value: (s: Settings) => string | undefined; patch: (sound: string) => Partial<Settings> }
> = {
  done: { value: (s) => s.doneSound, patch: (doneSound) => ({ doneSound }) },
  waiting: { value: (s) => s.waitingSound, patch: (waitingSound) => ({ waitingSound }) },
  error: { value: (s) => s.errorSound, patch: (errorSound) => ({ errorSound }) },
};

export function NotificationsPane() {
  const { machine, settings, update, commands } = useSettingsTarget();
  const shows = useRowReach();
  const sounds = useMachineList(shows("notifications.sound") ? commands.listSystemSounds : null);
  const soundEnabled = settings.soundNotifications ?? true;

  const alerts = shows("notifications.system") || shows("notifications.sound");
  const sendsResults = shows("notifications.telegram") || shows("notifications.sendToRequest");

  return (
    <>
      {alerts && (
        <SettingsSection title="Alerts and sounds">
          {shows("notifications.system") && (
            <SettingsRow {...rowProps("notifications.system")}>
              <Toggle
                enabled={settings.systemNotifications ?? true}
                onChange={(v) => void update({ systemNotifications: v })}
              />
            </SettingsRow>
          )}
          {shows("notifications.sound") && (
            <SettingsRow {...rowProps("notifications.sound")}>
              <Toggle enabled={soundEnabled} onChange={(v) => void update({ soundNotifications: v })} />
            </SettingsRow>
          )}
          {shows("notifications.sound") &&
            soundEnabled &&
            SOUND_EVENTS.map((r) => (
              <SettingsRow key={r.event} id={`sound.${r.event}`} label={r.label} description={r.description}>
                <SoundPicker
                  event={r.event}
                  value={SOUND_SETTINGS[r.event].value(settings) ?? "chime"}
                  sounds={sounds}
                  local={machine.kind === "local"}
                  onChange={(v) => void update(SOUND_SETTINGS[r.event].patch(v))}
                />
              </SettingsRow>
            ))}
        </SettingsSection>
      )}
      {sendsResults && (
        <SettingsSection title="Send automation results to">
          {shows("notifications.telegram") && <TelegramRow host={machine.kind === "peer" ? machine.slug : null} />}
          {shows("notifications.sendToRequest") && (
            <SettingsRow {...rowProps("notifications.sendToRequest")}>
              <button onClick={() => BrowserOpenURL(sendToRequestUrl())} className={BTN_SECONDARY}>
                Request on GitHub
              </button>
            </SettingsRow>
          )}
        </SettingsSection>
      )}
    </>
  );
}
