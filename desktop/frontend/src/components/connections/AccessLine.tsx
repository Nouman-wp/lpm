import type { PeerHostDevice } from "../../peer/usePeerState";
import { DetailLine } from "./DetailLine";
import { DANGER_BUTTON, SECONDARY_BUTTON } from "../mobile/styles";
import { MACHINE as M } from "../../machineWords";

// The other direction of a computer in the list: whether it can open this one.
export function AccessLine({
  device,
  hostEnabled,
  pairing,
  onRemoveAccess,
  onAllow,
}: {
  device: PeerHostDevice | null;
  hostEnabled: boolean;
  // An invite is out already, so allowing is pasting that one over there.
  pairing: boolean;
  onRemoveAccess: (device: PeerHostDevice) => void;
  onAllow?: () => void;
}) {
  const subtitle = device
    ? hostEnabled
      ? `It can open ${M.thisMachine}'s projects from over there`
      : `Allowed, once Allow control of ${M.thisMachine} is on`
    : pairing
      ? "Paste the invite below on it"
      : `It can't open ${M.thisMachine}`;

  return (
    <DetailLine title={`Let it open ${M.thisMachine}`} subtitle={subtitle}>
      {device ? (
        <button type="button" onClick={() => onRemoveAccess(device)} className={DANGER_BUTTON}>
          Remove access
        </button>
      ) : (
        !pairing &&
        onAllow && (
          <button type="button" onClick={onAllow} className={SECONDARY_BUTTON}>
            Allow
          </button>
        )
      )}
    </DetailLine>
  );
}
