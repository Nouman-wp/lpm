import { useEffect } from "react";
import { toast } from "../notifications/toast";
import { EventsOn } from "../../bridge/runtime";
import { MACHINE as M } from "../machineWords";

// Says when a paired machine removed this one, which drops it from here too
// (peerclient/removal.rs).
export function usePeerRemovedNotices(): void {
  useEffect(
    () =>
      EventsOn("peer-removed-remotely", (event: { name: string }) => {
        toast(`${event.name} removed ${M.thisMachine}`, {
          description: `Pair again from there to connect to it.`,
          event: "peers",
        });
      }),
    [],
  );
}
