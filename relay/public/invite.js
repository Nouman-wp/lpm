// The invite in this page's fragment, as lpm's Share dialog hands it out (see
// encode_invite in tabshare.rs). The fragment never leaves the browser.
const PAYLOAD = /^[A-Za-z0-9_-]+$/;
const ROOM = /^[A-Za-z0-9_-]{22}$/;
const CONTROL = /\p{Cc}/gu;
// As shown_text in tabshare.rs keeps them.
const MAX_SHOWN = 64;

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function shown(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(CONTROL, "")).slice(0, MAX_SHOWN).join("").trim();
}

// { secret, room, key, hostName, label, project }, the last three "" from lpm
// versions that don't send them; "network" for an invite lpm can only open on the
// host's network; null for anything that isn't an invite.
export function readInvite(hash) {
  const payload = hash.replace(/^#/, "");
  if (!PAYLOAD.test(payload)) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (o?.v !== 1 || typeof o.s !== "string" || !o.s) return null;
    if (typeof o.r !== "string" || typeof o.k !== "string") return "network";
    const key = fromBase64Url(o.k);
    if (!ROOM.test(o.r) || key.length !== 32) return null;
    return { secret: o.s, room: o.r, key, hostName: shown(o.n), label: shown(o.l), project: shown(o.j) };
  } catch {
    return null;
  }
}
