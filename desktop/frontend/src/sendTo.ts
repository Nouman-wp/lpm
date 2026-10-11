// Where an automation's results can be sent. "lpm" is the app itself (its
// toast, system notification and phone push); the rest are outside services,
// each linked once in Settings or from the job editor. Mirrors sendto.rs: a new
// service is an entry here and a module there.
//
// A destination id is a service ("telegram") or one of its targets
// ("telegram:releases"); the bare service means its first target.

export interface SendToOption {
  id: string;
  label: string;
  // Linked from inside the app (sendToConnectors.ts holds how).
  connectable?: boolean;
}

export const LPM_DESTINATION = "lpm";

export const SEND_TO_OPTIONS: SendToOption[] = [
  { id: LPM_DESTINATION, label: "lpm" },
  { id: "telegram", label: "Telegram", connectable: true },
];

export const DEFAULT_SEND_TO = [LPM_DESTINATION];

// One place inside a service a job can send to — a Telegram chat, say.
export interface SendToTarget {
  key: string;
  name: string;
  kind?: string;
}

// What each outside service is linked to, by service id; undefined while that's
// still being asked.
export type SendToLinks = Record<string, { connected: boolean; targets: SendToTarget[] } | undefined>;

export function splitSendTo(id: string): { service: string; key?: string } {
  const i = id.indexOf(":");
  return i < 0 ? { service: id } : { service: id.slice(0, i), key: id.slice(i + 1) };
}

export function targetId(service: string, key: string): string {
  return `${service}:${key}`;
}

export function canConnect(id: string): boolean {
  const { service } = splitSendTo(id);
  return SEND_TO_OPTIONS.some((o) => o.id === service && o.connectable);
}

export function serviceLabel(service: string): string {
  return SEND_TO_OPTIONS.find((o) => o.id === service)?.label ?? service;
}

// The bare service stands for its first target, so once that's known the list
// says which one — and a target picked twice that way counts once.
export function normalizeSendTo(ids: string[], links: SendToLinks): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const { service, key } = splitSendTo(id);
    const first = links[service]?.targets[0];
    const next = key === undefined && first ? targetId(service, first.key) : id;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

// Whether a destination can take a message: lpm always; a service once it's
// linked; one of its targets while it's still among them.
export function sendToReady(id: string, links: SendToLinks): boolean | undefined {
  const { service, key } = splitSendTo(id);
  if (service === LPM_DESTINATION) return true;
  const link = links[service];
  if (!link) return undefined;
  if (key === undefined) return link.connected;
  return link.connected && link.targets.some((t) => t.key === key);
}

export function sendToName(id: string, links: SendToLinks): string {
  const { service, key } = splitSendTo(id);
  if (service === LPM_DESTINATION) return "lpm";
  const targets = links[service]?.targets ?? [];
  const target = key === undefined ? targets[0] : targets.find((t) => t.key === key);
  return target?.name ?? key ?? serviceLabel(service);
}

// "lpm", "lpm + Releases", "lpm + 2 more" — in the order the menu lists them.
export function sendToSummary(ids: string[], links: SendToLinks): string {
  if (ids.length === 0) return "Nowhere";
  const order = SEND_TO_OPTIONS.map((o) => o.id);
  const names = [...ids]
    .sort((a, b) => order.indexOf(splitSendTo(a).service) - order.indexOf(splitSendTo(b).service))
    .map((id) => sendToName(id, links));
  return names.length <= 2 ? names.join(" + ") : `${names[0]} + ${names.length - 1} more`;
}

// `sendTo: telegram` or `sendTo: [lpm, telegram:ops]`; anything else is lpm alone.
export function readSendTo(value: unknown): string[] {
  const list = typeof value === "string" ? [value] : Array.isArray(value) ? value : null;
  if (!list) return [...DEFAULT_SEND_TO];
  const ids = list
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : [...DEFAULT_SEND_TO];
}

// What a job writes: nothing at all for the default, so a plain job stays terse.
// Services keep the menu's order; one this build doesn't know (written by a
// newer one) is kept, last.
export function writeSendTo(ids: string[]): string[] | undefined {
  const isDefault = ids.length === DEFAULT_SEND_TO.length && ids.every((id) => DEFAULT_SEND_TO.includes(id));
  if (isDefault) return undefined;
  const rank = (id: string) => {
    const i = SEND_TO_OPTIONS.findIndex((o) => o.id === splitSendTo(id).service);
    return i < 0 ? SEND_TO_OPTIONS.length : i;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b));
}
