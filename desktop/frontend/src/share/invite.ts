// An invite to one shared tab, as `peer_share_start` hands it out:
// `lpm-share:` + base64url(JSON { v:1, h:hosts, p:port, s:secret, f:fp }), or
// the same payload in a link (shareLink). An invite a browser can open also
// carries u:relay, r:room and k:key, which only the relay's page reads.
// Unlike a pairing invite it always carries the host's fingerprint, so the
// secret is only ever sent to the machine that minted it.
import { fromBase64Url, toBase64Url } from "../peer/invite";

export interface ShareInvite {
  hosts: string[];
  port: number;
  secret: string;
  fp: string;
  // What the invite says it opens, to greet with before joining; "" from an
  // older lpm, which didn't say.
  hostName: string;
  label: string;
  project: string;
}

const MAX_SHOWN = 64;

export const SHARE_INVITE_PREFIX = "lpm-share:";

// What a host sends: lpm.cx's join page, which opens lpm on the guest's
// computer. The invite rides in the fragment, which a browser never sends to
// the site.
export const SHARE_LINK_PREFIX = "https://lpm.cx/join#";
const SHARE_LINK = /^https?:\/\/(?:www\.)?lpm\.cx\/join\/?#([A-Za-z0-9_-]+)$/;
// What that page opens: lpm's own URL scheme.
const APP_LINK = /^lpm:\/\/join\/?\?(?:[^#]*&)?i=([A-Za-z0-9_-]+)/;

// The invite's payload from any form it travels in: the invite, the lpm.cx
// link, or the lpm:// link the page opens.
function sharePayload(input: string): string | null {
  const s = input.trim();
  if (s.startsWith(SHARE_INVITE_PREFIX)) return s.slice(SHARE_INVITE_PREFIX.length).trim();
  return (SHARE_LINK.exec(s) ?? APP_LINK.exec(s))?.[1] ?? null;
}

export function shareLink(invite: string): string {
  const payload = sharePayload(invite);
  return payload ? SHARE_LINK_PREFIX + payload : invite;
}

// The link in the QR code, kept small so a phone's camera reads it easily: only
// what the relay's page reads, with the names cut short. The page gets them in
// full once the guest is let in. An invite without a relay keeps its whole link.
const PHONE_FIELDS = ["v", "s", "u", "r", "k"];
const PHONE_NAMES = ["n", "l", "j"];
const PHONE_NAME_BYTES = 24;

export function phoneShareLink(invite: string): string {
  const o = payloadObject(invite);
  if (!o || typeof o.u !== "string" || typeof o.r !== "string" || typeof o.k !== "string") {
    return shareLink(invite);
  }
  const phone: Record<string, unknown> = {};
  for (const key of PHONE_FIELDS) phone[key] = o[key];
  for (const key of PHONE_NAMES) {
    const name = clipped(shown(o[key]), PHONE_NAME_BYTES);
    if (name) phone[key] = name;
  }
  return SHARE_LINK_PREFIX + toBase64Url(JSON.stringify(phone));
}

const utf8 = new TextEncoder();

function clipped(text: string, maxBytes: number): string {
  if (utf8.encode(text).length <= maxBytes) return text;
  let kept = "";
  for (const ch of text) {
    if (utf8.encode(`${kept}${ch}…`).length > maxBytes) break;
    kept += ch;
  }
  return `${kept.trimEnd()}…`;
}

export function looksLikeShareInvite(input: string): boolean {
  return sharePayload(input) !== null;
}

function payloadObject(input: string): Record<string, unknown> | null {
  const payload = sharePayload(input);
  const json = payload === null ? null : fromBase64Url(payload);
  if (json === null) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function decodeShareInvite(input: unknown): ShareInvite | null {
  if (typeof input !== "string") return null;
  const o = payloadObject(input);
  if (!o || o.v !== 1) return null;
  const hosts = Array.isArray(o.h) ? o.h.filter((x): x is string => typeof x === "string" && !!x) : [];
  const port = typeof o.p === "number" && Number.isInteger(o.p) && o.p > 0 ? o.p : null;
  const secret = typeof o.s === "string" ? o.s : "";
  const fp = typeof o.f === "string" ? o.f : "";
  if (hosts.length === 0 || port === null || !secret || !fp) return null;
  return { hosts, port, secret, fp, hostName: shown(o.n), label: shown(o.l), project: shown(o.j) };
}

function shown(value: unknown): string {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/\p{Cc}/gu, "")).slice(0, MAX_SHOWN).join("").trim();
}

// The link as the share popover shows it: short enough to read, the end kept
// so two links can be told apart.
export function shortShareLink(link: string): string {
  const [base, payload = ""] = link.replace(/^https?:\/\//, "").split("#");
  return payload ? `${base}#…${payload.slice(-4)}` : base;
}
