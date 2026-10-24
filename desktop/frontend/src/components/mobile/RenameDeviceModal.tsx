import { RenameModal } from "../RenameModal";
import { deviceName } from "../../mobile/pairingCode";
import type { PhoneDevice } from "../../mobile/phoneStatus";

export function RenameDeviceModal({
  device,
  machine,
  open,
  onClose,
  onRename,
}: {
  device: PhoneDevice;
  machine: string;
  open: boolean;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
}) {
  return (
    <RenameModal
      open={open}
      title="Rename device"
      description={`Only ${machine} uses this name. Nothing changes on the device.`}
      initialValue={deviceName(device)}
      placeholder={device.phoneName || "iPhone"}
      allowEmpty
      submitLabel={(value) => (value ? "Save" : "Use the device's own name")}
      onClose={onClose}
      onSubmit={(value) => {
        onClose();
        onRename(device.id, value);
      }}
    />
  );
}
