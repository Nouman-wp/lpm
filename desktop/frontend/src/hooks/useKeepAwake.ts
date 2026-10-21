import { useCallback, useEffect, useState } from "react";
import { EventsOn } from "../../bridge/runtime";
import { LOCAL_MOBILE } from "../components/settings/mobileCommands";
import { commandFailure } from "../remoteStatus";
import type { KeepAwakeStatus } from "../mobile/reachStatus";

export interface KeepAwake {
  on: boolean;
  status: KeepAwakeStatus;
  /** Why the last change wasn't saved, with the reason this pane can't show elsewhere. */
  failure: string | null;
  set: (on: boolean) => void;
}

interface KeepAwakeState {
  keepAwake?: boolean;
  keepAwakeStatus?: KeepAwakeStatus;
}

/** This machine's one Keep awake switch, which the Phone pane shows too: either
 *  pane changes it, and both follow it live. */
export function useKeepAwake(): KeepAwake {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<KeepAwakeStatus>("off");
  const [failure, setFailure] = useState<string | null>(null);

  const take = useCallback((s: unknown) => {
    const next = s as KeepAwakeState;
    setOn(!!next.keepAwake);
    setStatus(next.keepAwakeStatus ?? "off");
  }, []);

  const refresh = useCallback(
    () =>
      LOCAL_MOBILE.state()
        .then(take)
        .catch(() => {}),
    [take],
  );

  useEffect(() => {
    void refresh();
    const offs = ["remote-devices-changed", "remote-server-changed"].map((name) =>
      EventsOn(name, () => void refresh()),
    );
    return () => offs.forEach((off) => off());
  }, [refresh]);

  const set = useCallback(
    (next: boolean) => {
      setOn(next);
      setFailure(null);
      LOCAL_MOBILE.setKeepAwake(next).then(take, (err: unknown) => {
        setFailure(commandFailure("keepAwake", err, null).message);
        void refresh();
      });
    },
    [take, refresh],
  );

  return { on, status, failure, set };
}
