import { Modal } from "../../ui/Modal";
import { XIcon } from "../../icons";
import { SEND_TO_CONNECTORS, type ConnectIntent } from "../../../sendToConnectors";
import { sendToReady, serviceLabel, splitSendTo } from "../../../sendTo";
import { useSendToLinks } from "../../../hooks/useSendToLinks";

// Linking an outside destination — or one more of its chats — without leaving
// the view that needed it. Sits above that view, which holds its own Escape and
// backdrop while this is up.
export function SendToConnectModal({
  destination,
  host,
  intent = "connect",
  onClose,
  onAdded = () => {},
}: {
  destination: string | null;
  // The machine the destination is linked on: a connected one's slug, or null.
  host: string | null;
  intent?: ConnectIntent;
  onClose: () => void;
  onAdded?: (ids: string[]) => void;
}) {
  const links = useSendToLinks(host);
  const service = destination ? splitSendTo(destination).service : "";
  const connector = SEND_TO_CONNECTORS[service];
  const label = serviceLabel(service);
  const connected = !!destination && sendToReady(service, links) === true;
  const adding = intent === "add" && connected;

  return (
    <Modal
      open={!!connector}
      onClose={onClose}
      backdropClassName="bg-black/60 backdrop-blur-sm"
      contentClassName="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
      zIndexClassName="z-[60]"
    >
      <div className="flex w-[min(520px,calc(100vw-32px))] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
              {adding ? connector?.addTitle : `Connect ${label}`}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--text-muted)]">
              {adding
                ? "Each job can send its results to any of these."
                : `Once it's connected, any job can send its results to ${label}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <XIcon />
          </button>
        </header>
        <div className="px-6">
          {connector && <connector.Steps intent={intent} host={host} onAdded={onAdded} />}
        </div>
        <footer className="flex justify-end gap-2 px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={onClose}
            className={
              connected
                ? "rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--bg-primary)] shadow-sm transition hover:opacity-90"
                : "rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }
          >
            {connected ? "Done" : "Not now"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
