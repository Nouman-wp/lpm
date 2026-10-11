import { useEffect, useMemo } from "react";
import type { SendToLinks } from "../sendTo";
import { sendToLinks, useSendToStatus } from "../store/sendToStatus";

// What every outside destination is linked to, asked for once on mount and kept
// current by whichever view links or unlinks one.
export function useSendToLinks(): SendToLinks {
  const telegram = useSendToStatus((s) => s.telegram);
  const refresh = useSendToStatus((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => sendToLinks({ telegram, refresh }), [telegram, refresh]);
}
