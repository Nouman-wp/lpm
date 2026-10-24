import { useState } from "react";
import { Check } from "lucide-react";
import { RenameDeviceModal } from "./RenameDeviceModal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./styles";
import { deviceName } from "../../mobile/pairingCode";
import type { PhoneDevice } from "../../mobile/phoneStatus";

/** The phone that just used the code, and naming it while it's in mind. */
export function PairingPaired({
  device,
  machine,
  onRename,
  onDone,
}: {
  device: PhoneDevice;
  machine: string;
  onRename?: (id: string, name: string) => void;
  onDone: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const name = deviceName(device);

  return (
    <>
      <div className="flex flex-col items-center py-4 text-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-green) 15%, transparent)",
            color: "var(--accent-green-text)",
          }}
        >
          <Check size={20} strokeWidth={2.5} />
        </div>
        <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{name} paired</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">It can now see and control {machine}.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onRename && (
          <button onClick={() => setRenaming(true)} className={SECONDARY_BUTTON}>
            Rename
          </button>
        )}
        <button onClick={onDone} className={PRIMARY_BUTTON}>
          Done
        </button>
      </div>
      {onRename && (
        <RenameDeviceModal
          device={device}
          machine={machine}
          open={renaming}
          onClose={() => setRenaming(false)}
          onRename={onRename}
        />
      )}
    </>
  );
}
