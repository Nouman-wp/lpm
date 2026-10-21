type Args = Record<string, unknown> | undefined;
type Callback = (data: unknown) => void;

interface TauriInternals {
  invoke: (cmd: string, args?: Args) => Promise<unknown>;
  transformCallback: (cb?: Callback, once?: boolean) => number;
  unregisterCallback: (id: number) => void;
  runCallback: (id: number, data: unknown) => void;
  callbacks: Map<number, Callback>;
  convertFileSrc: (path: string, protocol?: string) => string;
  metadata: {
    currentWindow: { label: string };
    currentWebview: { windowLabel: string; label: string };
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

const callbacks = new Map<number, Callback>();
const listeners = new Map<string, Set<number>>();
// What a new listener to an event is handed first, like the scrollback the
// real backend replays to a pane that attaches to a running terminal.
const replays = new Map<string, () => unknown>();
let nextCallback = 1;

const taps = new Set<(event: string) => void>();

// Hears every event the backend sends, for code that follows state as a whole.
export function tapEvents(fn: (event: string) => void): void {
  taps.add(fn);
}

export function emitEvent(event: string, payload?: unknown): void {
  for (const tap of taps) tap(event);
  for (const id of listeners.get(event) ?? []) {
    callbacks.get(id)?.({ event, id, payload });
  }
}

export function replayOnListen(event: string, payload: (() => unknown) | null): void {
  if (payload) replays.set(event, payload);
  else replays.delete(event);
}

function eventPlugin(cmd: string, args: Record<string, unknown>): unknown {
  const event = String(args.event);
  if (cmd === "plugin:event|listen") {
    const id = args.handler as number;
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(id);
    const replay = replays.get(event);
    if (replay) {
      queueMicrotask(() => {
        const payload = replay();
        if (payload && listeners.get(event)?.has(id)) callbacks.get(id)?.({ event, id, payload });
      });
    }
    return id;
  }
  if (cmd === "plugin:event|unlisten") {
    listeners.get(event)?.delete(args.eventId as number);
    return null;
  }
  if (cmd === "plugin:event|emit") {
    emitEvent(event, args.payload);
    return null;
  }
  return null;
}

function plugin(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    case "plugin:window|inner_size":
    case "plugin:window|outer_size":
      return { width: window.innerWidth, height: window.innerHeight };
    case "plugin:window|scale_factor":
      return 1;
    case "plugin:opener|open_url":
      window.open(String(args.url), "_blank", "noopener");
      return null;
    default:
      return null;
  }
}

export function installIpc(
  resolve: (cmd: string, args: Record<string, unknown>) => unknown,
): void {
  window.__TAURI_INTERNALS__ = {
    async invoke(cmd, args) {
      const payload = args ?? {};
      if (cmd.startsWith("plugin:event|")) return eventPlugin(cmd, payload);
      if (cmd.startsWith("plugin:")) return plugin(cmd, payload);
      return resolve(cmd, payload);
    },
    transformCallback(cb, once = false) {
      const id = nextCallback++;
      callbacks.set(id, (data) => {
        if (once) callbacks.delete(id);
        cb?.(data);
      });
      return id;
    },
    unregisterCallback: (id) => void callbacks.delete(id),
    runCallback: (id, data) => callbacks.get(id)?.(data),
    callbacks,
    convertFileSrc: (path) => path,
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (_event, id) => void callbacks.delete(id),
  };
}
