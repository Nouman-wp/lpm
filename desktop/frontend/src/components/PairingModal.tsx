import { Modal } from "./ui/Modal";
import { PairingCode, type Pairing } from "./PairingCode";

export type { Pairing } from "./PairingCode";

export function PairingModal({
  pairing,
  machine,
  onClose,
  onSetUpTailscale,
}: {
  pairing: Pairing | null;
  machine?: string;
  onClose: () => void;
  onSetUpTailscale?: () => void;
}) {
  return (
    <Modal
      open={pairing !== null}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="w-[420px] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-xl"
    >
      {pairing && (
        <>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {machine ? `Pair a device with ${machine}` : "Pair a device"}
          </h3>
          <PairingCode
            pairing={pairing}
            machine={machine}
            onSetUpTailscale={onSetUpTailscale}
            onCancel={onClose}
            actions={
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85"
                >
                  Done
                </button>
              </div>
            }
          />
        </>
      )}
    </Modal>
  );
}
