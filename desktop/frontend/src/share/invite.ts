// An invite to one shared tab, as `peer_share_start` hands it out:
// `lpm-share:` + base64url(JSON { v:1, h:hosts, p:port, s:secret, f:fp }), or
// the same payload in a link (shareLink).
// Unlike a pairing invite it always carries the host's fingerprint, so the
// secret is only ever sent to the machine that minted it.
import { fromBase64Url } from "../peer/invite";

export interface ShareInvite {
  hosts: string[];
  port: number;
  secret: string;
  fp: string;
}

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

export function looksLikeShareInvite(input: string): boolean {
  return sharePayload(input) !== null;
}

export function decodeShareInvite(input: unknown): ShareInvite | null {
  if (typeof input !== "string") return null;
  const payload = sharePayload(input);
  if (payload === null) return null;
  const json = fromBase64Url(payload);
  if (json === null) return null;
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    o = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.v !== 1) return null;
  const hosts = Array.isArray(o.h) ? o.h.filter((x): x is string => typeof x === "string" && !!x) : [];
  const port = typeof o.p === "number" && Number.isInteger(o.p) && o.p > 0 ? o.p : null;
  const secret = typeof o.s === "string" ? o.s : "";
  const fp = typeof o.f === "string" ? o.f : "";
  if (hosts.length === 0 || port === null || !secret || !fp) return null;
  return { hosts, port, secret, fp };
}
