import { useEffect, useRef, useState } from "react";
import { Server } from "lucide-react";
import { PeerRemotePair, RemoteStartPairing } from "../../../bridge/commands";
import { BrowserOpenURL } from "../../../bridge/runtime";
import type { DrillApi } from "../DrillMenu";
import type { Pairing } from "../PairingCode";
import { RemoteNotice } from "../RemoteNotice";
import { LaptopIcon } from "../connections/LaptopIcon";
import { LOCAL_MOBILE } from "../settings/mobileCommands";
import { NoPhoneCard } from "./NoPhoneCard";
import { PairedPhoneRow } from "./PairedPhoneRow";
import { PairTargetRow } from "./PairTargetRow";
import { PhonePairScreen, type PairMachine } from "./PhonePairScreen";
import { LINK_BUTTON, SECONDARY_BUTTON } from "./styles";
import { usePhoneServer } from "../../mobile/usePhoneServer";
import { useAwayReach } from "../../mobile/useAwayReach";
import { sortPhones } from "../../mobile/phoneStatus";
import { APP_STORE_URL, SETUP_VIDEO_URL } from "../../mobile/links";
import { usePeerState } from "../../peer/usePeerState";
import { isLinuxHost } from "../../peer/platform";
import { REMOTE_TONE_STYLE, commandFailure, remoteStatus } from "../../remoteStatus";
import { useAppStore } from "../../store/app";
import { MACHINE } from "../../machineWords";

const TICK = 60_000;

const SECTION_LABEL =
  "px-1 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

/** The picker's way onto a phone: the devices already paired, the first-run
 *  steps when there are none, and a pairing code from this machine or from a
 *  connected one, as in Settings → Mobile devices. */
export function PhoneScreen({ drill, width }: { drill: DrillApi; width: string }) {
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setView = useAppStore((s) => s.setView);
  const { state, loaded, take } = usePhoneServer();
  const away = useAwayReach(state, take);
  const peers = usePeerState().state.peers;
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  // Backing out while a code is on its way mustn't push it onto another screen.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const id = setInterval(() => setNow(Date.now()), TICK);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, []);

  const pair = async (key: string, mint: () => Promise<Pairing>, machine?: PairMachine) => {
    setBusy(key);
    setFailure(null);
    try {
      const initial = await mint();
      if (!mounted.current) return;
      drill.push({
        title: machine ? `Pair with ${machine.name}` : "Pair a device",
        width,
        render: (api) => (
          <PhonePairScreen initial={initial} mint={mint} machine={machine} onBack={api.pop} onDone={api.close} />
        ),
      });
    } catch (err) {
      setFailure(
        machine
          ? `Couldn't get a pairing code from ${machine.name} — ${String(err)}`
          : commandFailure("pair", err, state.configError).message,
      );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const pairHere = () => void pair("here", async () => (await RemoteStartPairing()) as Pairing);
  const pairOn = (machine: PairMachine) =>
    void pair(machine.slug, async () => (await PeerRemotePair(machine.slug)) as Pairing, machine);

  const turnOn = async () => {
    setFailure(null);
    try {
      take(await LOCAL_MOBILE.setConfig(true, state.port, state.tailscale));
    } catch (err) {
      setFailure(commandFailure("server", err, state.configError).message);
    }
  };

  const openSettings = () => {
    drill.close();
    setSettingsTab("mobile");
    setView("settings");
  };

  const devices = state.devices;
  const problem = remoteStatus(state).problem;
  const shownFailure = failure ?? away.failure;

  return (
    <div className="flex max-h-[min(600px,72vh)] flex-col overflow-y-auto px-4 pb-3.5 pt-1">
      <p className="px-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Watch your terminals, answer your agents and run your projects from lpm Link on iPhone or iPad.
      </p>

      {state.configError && <RemoteNotice tone={REMOTE_TONE_STYLE.problem}>{state.configError}</RemoteNotice>}
      {problem && (
        <RemoteNotice tone={REMOTE_TONE_STYLE.problem}>
          <span className="font-medium text-[var(--accent-red-text)]">Remote control couldn&#39;t start.</span>{" "}
          {problem}
        </RemoteNotice>
      )}
      {!state.enabled && devices.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
            Remote control is off, so your devices can&#39;t connect.
          </p>
          <button onClick={() => void turnOn()} className={SECONDARY_BUTTON}>
            Turn on
          </button>
        </div>
      )}

      {!loaded ? null : devices.length === 0 ? (
        <div className="mt-3">
          <NoPhoneCard
            awayReady={away.awayReady}
            busy={busy === "here"}
            settingUpAway={away.settingUpAway}
            onPair={pairHere}
            onSetUpAway={() => void away.setUpAway()}
          />
        </div>
      ) : (
        <>
          <h4 className={SECTION_LABEL}>Your devices</h4>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {sortPhones(devices).map((d) => (
              <PairedPhoneRow key={d.id} device={d} now={now} />
            ))}
          </div>
        </>
      )}

      {loaded && (devices.length > 0 || peers.length > 0) && (
        <>
          <h4 className={SECTION_LABEL}>
            {devices.length === 0 ? "Or pair with another machine" : peers.length > 0 ? "Pair a device with" : "Pair another device"}
          </h4>
          <div className="-mx-1 flex flex-col">
            {devices.length > 0 && (
              <PairTargetRow
                icon={<LaptopIcon size={16} />}
                label={MACHINE.ThisMachine}
                detail={peers.length > 0 ? "Recommended" : "Scan a code with lpm Link, or approve it here"}
                busy={busy === "here"}
                disabled={busy !== null}
                onClick={pairHere}
              />
            )}
            {peers.map((p) => {
              const name = p.alias || p.host || "another machine";
              return (
                <PairTargetRow
                  key={p.slug}
                  icon={isLinuxHost(p) ? <Server size={16} /> : <LaptopIcon size={16} />}
                  label={name}
                  detail={
                    p.connected
                      ? `Keeps working while ${MACHINE.thisMachine} is off`
                      : "Not connected. Reconnect it under Connections."
                  }
                  busy={busy === p.slug}
                  disabled={busy !== null || !p.connected}
                  onClick={() => pairOn({ slug: p.slug, name })}
                />
              );
            })}
          </div>
        </>
      )}

      {shownFailure && <p className="px-1 pt-2 text-[11px] text-[var(--accent-red-text)]">{shownFailure}</p>}

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        lpm Link for iPhone and iPad ·{" "}
        <button onClick={() => BrowserOpenURL(APP_STORE_URL)} className={LINK_BUTTON}>
          App Store
        </button>{" "}
        ·{" "}
        <button onClick={() => BrowserOpenURL(SETUP_VIDEO_URL)} className={LINK_BUTTON}>
          Setup video
        </button>
        {devices.length > 0 && (
          <>
            {" "}
            ·{" "}
            <button onClick={openSettings} className={LINK_BUTTON}>
              Manage devices
            </button>
          </>
        )}
      </p>
    </div>
  );
}
