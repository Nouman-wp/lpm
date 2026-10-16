import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { PeerDispatchReply } from "../../bridge/commands";
import { IS_MIRROR_WINDOW } from "../mirror";
import { useAppStore } from "../store/app";
import { START_TERMINAL_CMDS } from "./router";

// A peer spawned a terminal on this host via the generic dispatcher (the pty is
// already running and the client injects its own startCmd). Register the new
// terminal as a tab in the host's UI, adopting the existing pty id — never a
// second terminal, never re-injecting the command.
function adoptPeerTerminal(cmd: string, args: unknown, value: unknown): void {
  if (!START_TERMINAL_CMDS.has(cmd)) return;
  const a = (args ?? {}) as Record<string, unknown>;
  const projectName = typeof a.projectName === "string" ? a.projectName : null;
  // start_terminal_for_config returns a TerminalLaunch { id, startCmd, resumeCmd };
  // the others return a bare id string.
  const launch = value as { id?: unknown; startCmd?: unknown; resumeCmd?: unknown } | null;
  const id = typeof value === "string" ? value : typeof launch?.id === "string" ? launch.id : null;
  if (!projectName || !id) return;

  const isConfig = cmd === "start_terminal_for_config";
  // The name, icon and color the Mac that ran it gave the tab; a config
  // terminal's key when it gave none (an older Mac).
  const tab = (a.tab ?? {}) as { label?: unknown; emoji?: unknown; color?: unknown; actionName?: unknown };
  const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const configName = isConfig ? text(a.terminalName) : undefined;
  const label = text(tab.label) ?? configName ?? "";
  const resumable = isConfig && typeof launch?.resumeCmd === "string" && launch.resumeCmd;
  const opts = {
    ...(resumable
      ? {
          startCmd: typeof launch.startCmd === "string" ? launch.startCmd : undefined,
          resumeCmd: launch.resumeCmd as string,
        }
      : {}),
    actionName: text(tab.actionName) ?? (resumable ? configName : undefined),
    emoji: text(tab.emoji),
    color: text(tab.color),
    // A Mac that leaves bringing the tab back after a restart to this one says so.
    ...(a.restoreHere === true ? { restoreHere: true } : {}),
  };
  useAppStore.getState().adoptRemoteTerminal(projectName, id, label, opts);
}

// Host-side generic dispatcher. When another Mac drives this one, its host Rust
// emits `peer-invoke` for any command it can't fast-path; the main window runs
// the real command locally and replies. Runs only in the main window (a mirror
// window has no authority) and executes concurrently — each request resolves
// independently, errors reported as ok:false with the error string.
export function usePeerDispatcher(): void {
  useEffect(() => {
    if (IS_MIRROR_WINDOW) return;
    let unlistenClosed: (() => void) | null = null;
    let disposed = false;
    // The peer closed one of its terminals on this host (Rust fast path emits
    // only for wire-initiated stops) — drop the adopted tab instead of leaving
    // a dead one.
    listen("peer-terminal-closed", (event) => {
      if (typeof event.payload === "string" && event.payload) {
        useAppStore.getState().removeRemoteTerminal(event.payload);
      }
    })
      .then((un) => {
        if (disposed) un();
        else unlistenClosed = un;
      })
      .catch(() => {});
    let unlisten: (() => void) | null = null;
    listen("peer-invoke", (event) => {
      const req = event.payload as { reqId?: unknown; cmd?: unknown; args?: unknown } | null;
      if (!req || req.reqId == null || typeof req.cmd !== "string") return;
      const reqId = req.reqId;
      const cmd = req.cmd;
      const args = req.args;
      invoke(cmd, (args ?? {}) as Record<string, unknown>)
        .then((value) => {
          // A failed adopt must not turn a successfully started terminal into
          // an error reply — the pty is already running on this host.
          try {
            adoptPeerTerminal(cmd, args, value);
          } catch {}
          return PeerDispatchReply(reqId, true, value ?? null);
        })
        .catch((err) => PeerDispatchReply(reqId, false, String(err)));
    })
      .then((un) => {
        if (disposed) un();
        else unlisten = un;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
      unlistenClosed?.();
    };
  }, []);
}
