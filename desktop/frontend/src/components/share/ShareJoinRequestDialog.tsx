import { useEffect, useState } from "react";
import { EventsOn } from "../../../bridge/runtime";
import { PeerShareRespond } from "../../../bridge/commands";
import { Modal } from "../ui/Modal";
import { useTabShares } from "../../store/tabShares";

interface JoinRequest {
  id: string;
  shareId: string;
  name: string;
  label: string;
}

// Someone with an invite asks to join a shared tab. Mounted at the app root so a
// request is caught whatever view is open; nobody is let in without an answer
// here (or in the share dialog's list).
export function ShareJoinRequestDialog() {
  const [queue, setQueue] = useState<JoinRequest[]>([]);
  const canType = useTabShares(
    (s) => s.hosted.find((h) => h.id === queue[0]?.shareId)?.canType ?? false,
  );

  useEffect(() => {
    const offRequest = EventsOn("peer-share-join-request", (r: JoinRequest) => {
      if (r?.id) setQueue((q) => (q.some((x) => x.id === r.id) ? q : [...q, r]));
    });
    const offResolved = EventsOn("peer-share-join-resolved", (r: { id?: string }) => {
      setQueue((q) => q.filter((x) => x.id !== r?.id));
    });
    return () => {
      if (typeof offRequest === "function") offRequest();
      if (typeof offResolved === "function") offResolved();
    };
  }, []);

  const request = queue[0];
  if (!request) return null;

  const respond = (allow: boolean) => {
    void PeerShareRespond(request.id, allow);
    setQueue((q) => q.filter((x) => x.id !== request.id));
  };

  return (
    <Modal
      open
      onClose={() => respond(false)}
      zIndexClassName="z-[60]"
      contentClassName="w-[380px] rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl"
    >
      <h2 className="text-base font-semibold text-[var(--text-primary)]">
        Let {request.name} join?
      </h2>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
        They'll see “{request.label}” live
        {canType ? " and can type in it." : ". They can't type in it until you allow it."}
      </p>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Only let them in if you sent them the invite.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => respond(false)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => respond(true)}
          className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-90"
        >
          Let in
        </button>
      </div>
    </Modal>
  );
}
