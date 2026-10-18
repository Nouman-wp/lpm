import { useCallback, useEffect, useState } from "react";
import { BrowserOpenURL, EventsOn } from "../../bridge/runtime";
import { LOCAL_TAILNET, type TailnetCommands } from "../components/settings/mobileCommands";
import { DEFAULT_TAILNET_STATE, type TailnetState } from "../tailnetStatus";

// A connected machine's changes don't arrive as events, so its state is read
// again this often while shown.
const POLL_MS = 3000;

export type TailnetBusy = "toggle" | "signIn" | "signOut" | null;

export interface Tailnet {
  state: TailnetState;
  /** False until the first answer, so nothing reads as "Off" before then. */
  loaded: boolean;
  busy: TailnetBusy;
  failure: string | null;
  /** This pane opened a sign-in page that the user hasn't finished yet. */
  opened: boolean;
  /** Turn on if needed and open the sign-in page when one is waiting. */
  signIn: () => Promise<void>;
  /** Absent where the machine keeps them its own (see TailnetCommands). */
  setEnabled?: (on: boolean) => Promise<void>;
  signOut?: () => Promise<void>;
}

/** Built-in Tailscale's state on a machine (this one by default), kept live,
 *  and the actions on it. */
export function useTailnetState(commands: TailnetCommands = LOCAL_TAILNET): Tailnet {
  const [state, setState] = useState<TailnetState>(DEFAULT_TAILNET_STATE);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<TailnetBusy>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const take = useCallback((s: unknown) => {
    const next = { ...DEFAULT_TAILNET_STATE, ...(s as Partial<TailnetState>) };
    setState(next);
    setLoaded(true);
    if (next.state !== "needsLogin") setOpened(false);
    // A failed command's notice is stale once the node has moved on to a
    // state that answers it.
    if (next.state === "running" || next.state === "needsApproval" || next.authUrl) {
      setFailure(null);
    }
  }, []);

  useEffect(() => {
    const read = () =>
      commands
        .state()
        .then(take)
        .catch(() => {});
    void read();
    if (commands !== LOCAL_TAILNET) {
      const timer = setInterval(read, POLL_MS);
      return () => clearInterval(timer);
    }
    const off = EventsOn("tailnet-changed", take);
    return () => {
      if (typeof off === "function") off();
    };
  }, [take, commands]);

  const run = useCallback(
    async (kind: Exclude<TailnetBusy, null>, action: () => Promise<unknown>) => {
      setBusy(kind);
      setFailure(null);
      try {
        const s = { ...DEFAULT_TAILNET_STATE, ...((await action()) as Partial<TailnetState>) };
        take(s);
        return s;
      } catch (err) {
        setFailure(String(err));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [take],
  );

  const { setEnabled: toggle, signOut: leave } = commands;

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!toggle) return;
      if (!on) setOpened(false);
      await run("toggle", () => toggle(on));
    },
    [run, toggle],
  );

  const signIn = useCallback(async () => {
    const s = await run("signIn", commands.signIn);
    if (s?.state === "needsLogin" && s.authUrl) {
      BrowserOpenURL(s.authUrl);
      setOpened(true);
    }
  }, [run, commands]);

  const signOut = useCallback(async () => {
    if (!leave) return;
    setOpened(false);
    await run("signOut", leave);
  }, [run, leave]);

  return {
    state,
    loaded,
    busy,
    failure,
    opened,
    signIn,
    setEnabled: toggle && setEnabled,
    signOut: leave && signOut,
  };
}
