import { useEffect, useRef } from "react";
import { PeerState } from "../../bridge/commands";
import { usePeerState, type PeerStateShape } from "../peer/usePeerState";
import { usePeerConnect } from "../peer/usePeerConnect";
import { decodeInvite } from "../peer/invite";
import { peerSlugOf } from "../peer/markers";
import { useAppStore } from "../store/app";
import { AddMacPanel } from "./connections/AddMacPanel";
import { ClipboardInviteRow } from "./connections/ClipboardInviteRow";
import { NearbyMacRow } from "./connections/NearbyMacRow";
import { ConnectedComputerRow } from "./ConnectedComputerRow";

const SECTION_LABEL =
  "px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

const EMPHASIS = "font-medium text-[var(--text-primary)]";

// The picker's way onto another computer running lpm: the ones already paired,
// the ones found on this network, and an invite, as in Settings → Connections.
// Pairing carries on to adding a project on that computer.
export function AnotherComputerScreen() {
  const addProjectForPeer = useAppStore((s) => s.addProjectForPeer);
  const projects = useAppStore((s) => s.projects);
  const { state, refresh } = usePeerState();
  const pairing = usePeerConnect({ peers: state.peers, host: state.host, refresh, cancelOnUnmount: true });
  // Backing out mid-pairing still pairs; it just shouldn't reopen the picker.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const openPaired = async (attempt: Promise<string | null>, fallbackName: string) => {
    const slug = await attempt;
    if (slug === null) return false;
    if (!slug || !mounted.current) return true;
    const peer = ((await PeerState()) as PeerStateShape).peers.find((p) => p.slug === slug);
    if (mounted.current) addProjectForPeer(slug, peer?.alias || peer?.host || fallbackName, true);
    return true;
  };

  const projectCount = (slug: string) => projects.filter((p) => peerSlugOf(p.name) === slug).length;
  const clipboard = pairing.clipboard;

  return (
    <div className="flex max-h-[min(600px,72vh)] flex-col overflow-y-auto pb-3">
      {clipboard && (
        <div className="mx-2 mb-1 overflow-hidden rounded-xl">
          <ClipboardInviteRow
            invite={clipboard.invite}
            busy={pairing.adding}
            onConnect={() => void openPaired(pairing.connectClipboard(), clipboard.invite.hosts[0] ?? "")}
            onDismiss={pairing.dismissClipboard}
          />
        </div>
      )}

      {state.peers.length > 0 && (
        <>
          <h4 className={SECTION_LABEL}>Your computers</h4>
          <div className="flex flex-col px-2">
            {state.peers.map((p) => (
              <ConnectedComputerRow
                key={p.slug}
                peer={p}
                projectCount={projectCount(p.slug)}
                onOpen={() => addProjectForPeer(p.slug, p.alias || p.host)}
              />
            ))}
          </div>
        </>
      )}

      {pairing.nearby.length > 0 && (
        <>
          <h4 className={SECTION_LABEL}>Nearby</h4>
          {pairing.nearby.map((m) => (
            <NearbyMacRow
              key={m.id}
              mac={m}
              waiting={pairing.request?.id === m.id}
              sas={pairing.request?.id === m.id ? pairing.request.sas : ""}
              disabled={pairing.request !== null}
              onConnect={() => void openPaired(pairing.connectNearby(m), m.name)}
              onCancel={pairing.cancelRequest}
            />
          ))}
        </>
      )}

      <h4 className={SECTION_LABEL}>With an invite</h4>
      <AddMacPanel
        busy={pairing.adding}
        onInvite={(raw) => openPaired(pairing.connectInvite(raw), decodeInvite(raw)?.hosts[0] ?? "")}
        onManual={(address, port, code) => openPaired(pairing.connectManual(address, port, code), address)}
      />

      {pairing.error && <p className="px-4 pt-1 text-[11px] text-[var(--accent-red)]">{pairing.error}</p>}

      <p className="mx-4 mt-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
        No invite yet? On the other computer, open <span className={EMPHASIS}>Settings → Connections</span> and
        create one. To show up under Nearby, it needs <span className={EMPHASIS}>Allow control</span> turned on.
      </p>
    </div>
  );
}
