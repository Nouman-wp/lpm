import { useCallback, useEffect, useRef, useState } from "react";
import { AgentLimits, PeerInvoke } from "../../bridge/commands";
import { EventsOn } from "../../bridge/runtime";

export interface LimitWindow {
  usedPercent: number;
  resetsAt: number; // unix seconds; 0 when unknown
}

export interface ProviderLimits {
  provider: "claude" | "codex" | string;
  accountId?: string;
  label?: string;
  fiveHour?: LimitWindow;
  weekly?: LimitWindow;
  updatedAt: number; // unix millis
  noLimits?: boolean; // a Claude login whose replies carry no plan windows
}

export type AgentLimitsMap = Record<string, ProviderLimits>;

export interface AgentLimitsState {
  limits: AgentLimitsMap;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const CHANGED_EVENT = "agent-limits-changed";

// A machine's snapshot: this Mac's, or the paired machine `host`'s.
function readLimits(host: string | null): Promise<unknown> {
  return host ? PeerInvoke(host, "agent_limits", {}) : AgentLimits();
}

// Its changes. A paired machine's arrive on its own stream only, so they never
// stand in for this Mac's readings.
function onLimitsChanged(host: string | null, callback: (m: unknown) => void): () => void {
  if (!host) return EventsOn(CHANGED_EVENT, callback);
  return EventsOn(`peer-evt-${host}`, (event: { name?: string; payload?: unknown } | null) => {
    if (event?.name === CHANGED_EVENT) callback(event.payload);
  });
}

// Initial fetch of the current snapshot, kept live by the backend's
// `agent-limits-changed` event (Codex file watcher + Claude statusline forwarder).
// A paired machine's (`host`) are its own accounts' readings.
export function useAgentLimits(host: string | null = null): AgentLimitsState {
  const [limits, setLimits] = useState<AgentLimitsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);
  // A push event carries a newer snapshot than any in-flight fetch, so bumping
  // the token retires that fetch instead of letting its older reading land last.
  const token = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const mine = ++token.current;
    const current = () => alive.current && mine === token.current;
    setLoading(true);
    setError("");
    try {
      const m = await readLimits(host);
      if (current()) setLimits((m ?? {}) as AgentLimitsMap);
    } catch (err) {
      if (current()) setError(String(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    setLimits({});
    void refresh();
    const off = onLimitsChanged(host, (m) => {
      token.current += 1;
      setLimits((m ?? {}) as AgentLimitsMap);
      setLoading(false);
      setError("");
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, [host, refresh]);

  return { limits, loading, error, refresh };
}

// Codex reports one snapshot; Claude reports one per account, so pick the
// most-recently-updated Claude entry for the compact sidebar row.
export function pickProvider(
  map: AgentLimitsMap,
  provider: "claude" | "codex",
): ProviderLimits | undefined {
  let best: ProviderLimits | undefined;
  for (const v of Object.values(map)) {
    if (v.provider !== provider) continue;
    if (!best || v.updatedAt > best.updatedAt) best = v;
  }
  return best;
}
