import { useCallback, useEffect, useRef, useState } from "react";
import {
  PeerAdd,
  PeerPairRequest,
  PeerPairCancel,
  PeerDiscoveryStart,
  PeerDiscoveryStop,
  ReadClipboardText,
} from "../../bridge/commands";
import { EventsOn } from "../../bridge/runtime";
import { decodeInvite, type PeerInvite } from "./invite";
import type { DiscoveredPeer, PeerClient, PeerHostState } from "./usePeerState";

// The machine we're currently asking to pair with, plus the code to compare once
// it responds.
export interface PendingPairRequest {
  id: string;
  name: string;
  sas: string;
}

export type PeerConnect = ReturnType<typeof usePeerConnect>;

export interface ClipboardInvite {
  raw: string;
  invite: PeerInvite;
}

// Every way to pair with another computer running lpm: an invite (pasted, typed
// in, or found in the clipboard), or asking one lpm found on this network to
// approve us. Each connect resolves to the new peer's slug, or null when it
// didn't pair and `error` says why.
export function usePeerConnect({
  peers,
  host,
  refresh,
  cancelOnUnmount = false,
}: {
  peers: PeerClient[];
  host: PeerHostState;
  refresh: () => Promise<void>;
  cancelOnUnmount?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredPeer[]>([]);
  const [request, setRequest] = useState<PendingPairRequest | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardInvite | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const requestRef = useRef<PendingPairRequest | null>(null);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  const add = useCallback(
    async (hosts: string[], port: number, code: string, fp?: string): Promise<string | null> => {
      setAdding(true);
      setError(null);
      try {
        // Empty alias → the host auto-names the peer after the remote machine.
        const res = (await PeerAdd(hosts, port, code, "", fp)) as { slug?: string } | null;
        await refresh();
        return res?.slug ?? "";
      } catch (err) {
        setError(String(err));
        return null;
      } finally {
        setAdding(false);
      }
    },
    [refresh],
  );

  const connectInvite = useCallback(
    async (raw: string): Promise<string | null> => {
      const invite = decodeInvite(raw);
      if (!invite) {
        setError("That isn't a complete invite.");
        return null;
      }
      return add(invite.hosts, invite.port, invite.code, invite.fp);
    },
    [add],
  );

  const connectManual = useCallback(
    (address: string, port: number, code: string) => add([address], port, code),
    [add],
  );

  // --- LAN discovery --------------------------------------------------------
  useEffect(() => {
    void PeerDiscoveryStart();
    const off = EventsOn("peer-discovery", (list: DiscoveredPeer[]) => {
      setDiscovered(Array.isArray(list) ? list : []);
    });
    return () => {
      if (typeof off === "function") off();
      void PeerDiscoveryStop();
    };
  }, []);

  // Pairing-request progress: the SAS to compare arrives here; failure surfaces
  // inline. Success flows through peer-state-changed (the paired machine appears
  // in the list and its discovery row hides), which also clears the waiting row.
  useEffect(() => {
    const offPending = EventsOn("peer-pair-pending", (p: { sas: string }) => {
      setRequest((cur) => (cur ? { ...cur, sas: p?.sas ?? "" } : cur));
    });
    const offFailed = EventsOn("peer-pair-failed", (p: { error: string }) => {
      setError(p?.error || "Pairing failed.");
      setRequest(null);
    });
    return () => {
      if (typeof offPending === "function") offPending();
      if (typeof offFailed === "function") offFailed();
    };
  }, []);

  const pairedHostIds = new Set(peers.map((p) => p.hostId).filter(Boolean));
  const nearby = discovered.filter((m) => !pairedHostIds.has(m.id));

  // Drop the waiting row once its machine becomes a peer.
  useEffect(() => {
    if (request && pairedHostIds.has(request.id)) setRequest(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers]);

  const connectNearby = useCallback(
    async (m: DiscoveredPeer): Promise<string | null> => {
      setError(null);
      setRequest({ id: m.id, name: m.name, sas: "" });
      try {
        const res = (await PeerPairRequest(m.hosts, m.port)) as { slug?: string } | null;
        setRequest(null);
        await refresh();
        return res?.slug ?? "";
      } catch {
        // peer-pair-failed already surfaced the message and cleared the row.
        return null;
      }
    },
    [refresh],
  );

  const cancelRequest = useCallback(() => {
    void PeerPairCancel();
    setRequest(null);
  }, []);

  // Leaving a screen that showed the code to compare leaves nobody to compare it.
  useEffect(() => {
    if (!cancelOnUnmount) return;
    return () => {
      if (requestRef.current) void PeerPairCancel();
    };
  }, [cancelOnUnmount]);

  // --- clipboard invite auto-detect -----------------------------------------
  const checkClipboard = useCallback(async () => {
    try {
      const raw = ((await ReadClipboardText()) as string) ?? "";
      const trimmed = raw.trim();
      const invite = decodeInvite(trimmed);
      if (!invite) return void setClipboard(null);
      if (trimmed === dismissedRef.current) return void setClipboard(null);
      // Our own invite, just copied to the clipboard.
      if (host.pairing && invite.code === host.pairing.code) return void setClipboard(null);
      // Already connected to this machine.
      const dup = peers.some((p) => invite.hosts.includes(p.host) && p.port === invite.port);
      if (dup) return void setClipboard(null);
      setClipboard({ raw: trimmed, invite });
    } catch {
      /* clipboard unavailable — leave any prior offer as-is */
    }
  }, [host.pairing, peers]);

  useEffect(() => {
    void checkClipboard();
    const onFocus = () => void checkClipboard();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkClipboard]);

  const connectClipboard = useCallback(async (): Promise<string | null> => {
    if (!clipboard) return null;
    setClipboard(null);
    return connectInvite(clipboard.raw);
  }, [clipboard, connectInvite]);

  const dismissClipboard = useCallback(() => {
    if (clipboard) dismissedRef.current = clipboard.raw;
    setClipboard(null);
  }, [clipboard]);

  return {
    adding,
    error,
    nearby,
    request,
    clipboard,
    connectInvite,
    connectManual,
    connectNearby,
    cancelRequest,
    connectClipboard,
    dismissClipboard,
  };
}
