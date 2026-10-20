import { useState } from "react";
import { useTailnetState } from "../hooks/useTailnetState";
import { builtInReachable } from "../tailnetStatus";
import { LOCAL_MOBILE } from "../components/settings/mobileCommands";
import { commandFailure } from "../remoteStatus";
import { canReachAway } from "./reachStatus";
import { anyOverTailscale } from "./phoneStatus";
import type { RemoteStateShape } from "./usePhoneServer";

/** Whether a phone off this machine's network can reach it, and the way to make
 *  it so: the Tailscale app's address when the app runs here, else the built-in
 *  Tailscale turned on and signed in. */
export function useAwayReach(
  state: RemoteStateShape,
  take: (s: unknown) => void,
): { awayReady: boolean; settingUpAway: boolean; failure: string | null; setUpAway: () => Promise<void> } {
  const tailnet = useTailnetState();
  const [failure, setFailure] = useState<string | null>(null);
  const awayReady = canReachAway({
    ...state,
    builtInRunning: builtInReachable(tailnet.state),
    deviceUsedTailscale: anyOverTailscale(state.devices),
  });

  const setUpAway = async () => {
    setFailure(null);
    if (!state.tailscaleHost || state.tailscale) return tailnet.signIn();
    try {
      take(await LOCAL_MOBILE.setConfig(state.enabled, state.port, true));
    } catch (err) {
      setFailure(commandFailure("tailscale", err, state.configError).message);
    }
  };

  return {
    awayReady,
    settingUpAway: tailnet.busy === "signIn",
    failure: failure ?? tailnet.failure,
    setUpAway,
  };
}
