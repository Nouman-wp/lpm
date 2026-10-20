import type { SwitchableCLI } from "./agentModelSwitch";
import type { AIModelOption } from "./types";

// The models last switched to from the composer's model menu, newest first, per
// agent and on this computer, so the menu can lead with them.
const KEY = "lpm:model-switch:recent:v1";
const KEEP = 6;
const LEADING = 3;

type Saved = Partial<Record<SwitchableCLI, unknown>>;

function readSaved(): Saved {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" ? (saved as Saved) : {};
  } catch {
    return {};
  }
}

export function recentModels(cli: SwitchableCLI): string[] {
  const list = readSaved()[cli];
  return Array.isArray(list) ? list.filter((m): m is string => typeof m === "string") : [];
}

export function rememberModel(cli: SwitchableCLI, model: string): void {
  if (!model) return;
  const saved = readSaved();
  saved[cli] = [model, ...recentModels(cli).filter((m) => m !== model)].slice(0, KEEP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* a convenience only */
  }
}

/** The models the menu leads with (the running one, then recent picks, then
 *  the agent's own order) and the rest, folded under "More models". A fold that
 *  would hide a single model shows it instead. */
export function splitModels(
  models: AIModelOption[],
  running: string,
  recent: string[],
): { top: AIModelOption[]; rest: AIModelOption[] } {
  if (models.length <= LEADING + 1) return { top: models, rest: [] };
  const byValue = new Map(models.map((m) => [m.value, m]));
  const top: AIModelOption[] = [];
  for (const value of [running, ...recent, ...byValue.keys()]) {
    const model = byValue.get(value);
    if (model && !top.includes(model)) top.push(model);
    if (top.length === LEADING) break;
  }
  return { top, rest: models.filter((m) => !top.includes(m)) };
}
