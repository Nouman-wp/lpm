import { useEffect, useMemo } from "react";
import type { SendToLinks } from "../sendTo";
import { sendToLinks, telegramLinkOf, useSendToStatus } from "../store/sendToStatus";

// What every outside destination is linked to on the machine a job runs on
// (`host`, null for this one), asked for once and kept current by whichever view
// links or unlinks one.
export function useSendToLinks(host: string | null): SendToLinks {
  const telegram = useSendToStatus((s) => telegramLinkOf(s, host));
  const refresh = useSendToStatus((s) => s.refresh);

  useEffect(() => {
    void refresh(host);
  }, [refresh, host]);

  return useMemo(() => sendToLinks(telegram), [telegram]);
}
