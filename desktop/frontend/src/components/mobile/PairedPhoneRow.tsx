import { Smartphone } from "lucide-react";
import { TILE_STYLE } from "./styles";
import { phoneSubtitle, type PhoneDevice } from "../../mobile/phoneStatus";
import { MACHINE } from "../../machineWords";

/** A phone paired with this machine, as a short read-only line: who it is and
 *  whether it's here. Renaming and revoking stay in Settings. */
export function PairedPhoneRow({ device, now }: { device: PhoneDevice; now: number }) {
  const name = device.name || device.phoneName || "Device";
  const sub = phoneSubtitle(device, now, MACHINE.thisMachine);

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={TILE_STYLE[device.connected ? "live" : "idle"]}
      >
        <Smartphone size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {sub.lead && <span style={{ color: "var(--accent-green-text)" }}>{sub.lead}</span>}
          {sub.lead && sub.rest ? " · " : ""}
          {sub.rest}
        </p>
      </div>
    </div>
  );
}
