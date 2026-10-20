import { MobileSettingsPane } from "../MobileSettingsPane";
import { SettingsTargetContext } from "../settings/settingsTarget";
import { useLocalSettingsTarget } from "../settings/useLocalSettingsTarget";

/** The picker's way onto a phone: Settings → Mobile devices for this machine,
 *  so remote control, the ways in, the paired devices and pairing work the same
 *  as there. */
export function PhoneScreen() {
  const target = useLocalSettingsTarget();
  return (
    <SettingsTargetContext.Provider value={target}>
      <div className="max-h-[min(720px,80vh)] overflow-y-auto px-5 pb-5">
        <MobileSettingsPane />
      </div>
    </SettingsTargetContext.Provider>
  );
}
