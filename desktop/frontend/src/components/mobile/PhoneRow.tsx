import { useState } from "react";
import { Smartphone } from "lucide-react";
import { RowMenu } from "../connections/RowMenu";
import { RenameDeviceModal } from "./RenameDeviceModal";
import { QUIET_BUTTON, TILE_STYLE } from "./styles";
import { deviceName } from "../../mobile/pairingCode";
import { phoneSubtitle, type PhoneDevice } from "../../mobile/phoneStatus";
import { useMachineWords } from "../settings/useMachineWords";

/** A paired phone: who it is, whether it's here, and the rare actions on it
 *  behind a menu, with Revoke confirmed in place. */
export function PhoneRow({
  device,
  now,
  onRename,
  onRevoke,
}: {
  device: PhoneDevice;
  now: number;
  onRename: (id: string, name: string) => void;
  onRevoke: (id: string) => void;
}) {
  const words = useMachineWords();
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const name = deviceName(device);
  const sub = phoneSubtitle(device, now, words.thisMachine);

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
          style={TILE_STYLE[device.connected ? "live" : "idle"]}
        >
          <Smartphone size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {sub.lead && <span style={{ color: "var(--accent-green-text)" }}>{sub.lead}</span>}
            {sub.lead && sub.rest ? " · " : ""}
            {sub.rest}
          </p>
        </div>
        <RowMenu
          ariaLabel={`Options for ${name}`}
          items={[
            { label: "Rename…", onClick: () => setRenaming(true) },
            { label: "Revoke…", onClick: () => setConfirming(true), destructive: true },
          ]}
        />
      </div>
      {confirming && (
        <div
          className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent-red) 7%, transparent)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Revoke {name}?</p>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              {device.connected
                ? `It's connected right now. It disconnects at once, drops ${words.thisMachine} too, and needs a new pairing to come back.`
                : `It drops ${words.thisMachine} too the next time it connects, and needs a new pairing to connect again.`}
            </p>
          </div>
          <button onClick={() => setConfirming(false)} className={QUIET_BUTTON}>
            Cancel
          </button>
          <button
            onClick={() => onRevoke(device.id)}
            className="shrink-0 rounded-lg bg-[var(--accent-red)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Revoke
          </button>
        </div>
      )}
      <RenameDeviceModal
        device={device}
        machine={words.thisMachine}
        open={renaming}
        onClose={() => setRenaming(false)}
        onRename={onRename}
      />
    </div>
  );
}
