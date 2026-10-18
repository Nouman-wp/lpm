import { useEffect } from "react";
import { toast } from "sonner";
import { EventsOn } from "../../bridge/runtime";

interface NotSaved {
  name: string;
  host: string;
  error: string;
  conflict: boolean;
}

// Says when a save to a paired machine's file, made in an editor here, didn't
// reach that machine (peercopysync.rs).
export function usePeerFileSaveNotices(): void {
  useEffect(
    () =>
      EventsOn("peer-file-not-saved", (event: NotSaved) => {
        if (event.conflict) {
          toast.error(`${event.name} wasn't saved to ${event.host}`, {
            description: "It changed there since you opened it. Open it again to edit the latest.",
          });
        } else {
          toast.error(`${event.name} wasn't saved to ${event.host}: ${event.error}`);
        }
      }),
    [],
  );
}
