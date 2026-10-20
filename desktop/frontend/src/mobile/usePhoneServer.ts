import { useCallback, useEffect, useState } from "react";
import { EventsOn } from "../../bridge/runtime";
import { LOCAL_MOBILE, type MobileCommands } from "../components/settings/mobileCommands";
import type { KeepAwakeStatus } from "./reachStatus";
import type { PhoneDevice } from "./phoneStatus";

// A connected machine's phones and server don't announce changes here, so its
// state is read again this often while shown.
const POLL_MS = 3000;

/** A machine's phone server as `remote_state` reports it. */
export interface RemoteStateShape {
  enabled: boolean;
  port: number;
  tailscale: boolean;
  keepAwake: boolean;
  keepAwakeStatus: KeepAwakeStatus;
  running: boolean;
  host: string | null;
  tailscaleHost: string | null;
  identityRotated: boolean;
  identityCode: string;
  hasPendingCode: boolean;
  bindError: string | null;
  configError: string | null;
  devices: PhoneDevice[];
}

export const DEFAULT_REMOTE_STATE: RemoteStateShape = {
  enabled: false,
  port: 8765,
  tailscale: true,
  keepAwake: false,
  keepAwakeStatus: "off",
  running: false,
  host: null,
  tailscaleHost: null,
  identityRotated: false,
  identityCode: "",
  hasPendingCode: false,
  bindError: null,
  configError: null,
  devices: [],
};

/** A machine's phone server (this one by default), kept live: this one by its
 *  events, plus every `pollMs` when given; a connected one by polling. */
export function usePhoneServer(
  mobile: MobileCommands = LOCAL_MOBILE,
  pollMs?: number,
): {
  state: RemoteStateShape;
  loaded: boolean;
  refresh: () => Promise<RemoteStateShape | null>;
  take: (s: unknown) => void;
} {
  const [state, setState] = useState<RemoteStateShape>(DEFAULT_REMOTE_STATE);
  const [loaded, setLoaded] = useState(false);

  const take = useCallback((s: unknown) => {
    setState({ ...DEFAULT_REMOTE_STATE, ...(s as Partial<RemoteStateShape>) });
    setLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = { ...DEFAULT_REMOTE_STATE, ...((await mobile.state()) as Partial<RemoteStateShape>) };
      take(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, [mobile, take]);

  useEffect(() => {
    void refresh();
    const local = mobile === LOCAL_MOBILE;
    const every = local ? pollMs : (pollMs ?? POLL_MS);
    const timer = every ? setInterval(() => void refresh(), every) : null;
    const offs = local
      ? [EventsOn("remote-devices-changed", () => void refresh()), EventsOn("remote-server-changed", () => void refresh())]
      : [];
    return () => {
      if (timer) clearInterval(timer);
      for (const off of offs) if (typeof off === "function") off();
    };
  }, [refresh, mobile, pollMs]);

  return { state, loaded, refresh, take };
}
