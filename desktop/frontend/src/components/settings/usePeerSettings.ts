import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../../notifications/toast";
import { PeerSettingsGet, PeerSettingsSet } from "../../../bridge/commands";
import type { PeerMachine } from "../../settingsMachine";
import { settingsFromFile, type Settings } from "../../store/settings";
import { machineCommands } from "./machineCommands";
import type { SettingsTarget } from "./settingsTarget";

// The fields a machine shares, as it stores them (peersettings.rs).
type SharedSettings = Record<string, unknown>;

export type PeerSettingsState =
  | { status: "loading" }
  | { status: "failed"; error: string; retry: () => void }
  | { status: "ready"; target: SettingsTarget };

// A connected machine's settings, read whenever it can answer (`enabled`) and
// changed a patch at a time: a change shows at once, then gives way to what the
// machine says it stored.
export function usePeerSettings(machine: PeerMachine, enabled: boolean): PeerSettingsState {
  const { slug, name } = machine;
  const [shared, setShared] = useState<SharedSettings | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lastWrite = useRef(0);

  useEffect(() => {
    setShared(null);
    setError("");
    if (!enabled) return;
    let cancelled = false;
    PeerSettingsGet(slug)
      .then((value) => {
        if (!cancelled) setShared(asShared(value));
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, enabled, attempt]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const wire = wirePatch(patch);
      const write = ++lastWrite.current;
      setShared((current) => current && withPatch(current, wire));
      try {
        const stored = asShared(await PeerSettingsSet(slug, wire));
        if (write === lastWrite.current) setShared(stored);
      } catch (err) {
        toast.error(`Couldn't change a setting on ${name}: ${err}`);
        PeerSettingsGet(slug)
          .then((value) => setShared(asShared(value)))
          .catch(() => {});
      }
    },
    [slug, name],
  );

  const commands = machineCommands(slug);
  const target = useMemo<SettingsTarget | null>(
    () => shared && { machine, settings: settingsFromFile(shared), update, commands },
    [shared, machine, update, commands],
  );

  if (target) return { status: "ready", target };
  if (error) return { status: "failed", error, retry: () => setAttempt((n) => n + 1) };
  return { status: "loading" };
}

function asShared(value: unknown): SharedSettings {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SharedSettings)
    : {};
}

// A patch unsets a field with `undefined`, which JSON drops; the machine takes
// `null` for it.
function wirePatch(patch: Partial<Settings>): SharedSettings {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value ?? null]));
}

function withPatch(shared: SharedSettings, wire: SharedSettings): SharedSettings {
  const next = { ...shared };
  for (const [key, value] of Object.entries(wire)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}
