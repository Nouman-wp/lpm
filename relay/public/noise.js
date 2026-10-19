// Noise_NK_25519_AESGCM_SHA256, the browser's side of a shared tab's session. The
// host's side is desktop/frontend/src-tauri/src/sharenoise.rs; the two must stay
// byte-identical. Everything runs on WebCrypto, so no third-party code ever
// touches a key.
//
// A frame (one JSON text) travels as one or more Noise messages, each opening
// with a flag byte: 1 on the frame's last piece, 0 on the ones before it.

const PROTOCOL = "Noise_NK_25519_AESGCM_SHA256";
const PROLOGUE = "lpm-share-relay/1 ";
const DH_LEN = 32;
const TAG = 16;
const PIECE = 32 * 1024;
const MAX_FRAME = 16 * 1024 * 1024;

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function sha256(data) {
  return new Uint8Array(await subtle.digest("SHA-256", data));
}

async function hmac(key, data) {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}

async function hkdf(chainingKey, input) {
  const temp = await hmac(chainingKey, input);
  const first = await hmac(temp, Uint8Array.of(1));
  const second = await hmac(temp, concat(first, Uint8Array.of(2)));
  return [first, second];
}

async function dh(privateKey, publicBytes) {
  const pub = await subtle.importKey("raw", publicBytes, { name: "X25519" }, false, []);
  return new Uint8Array(await subtle.deriveBits({ name: "X25519", public: pub }, privateKey, 256));
}

class CipherState {
  constructor(key) {
    this.key = key;
    this.n = 0;
  }

  static async of(raw) {
    return new CipherState(await subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]));
  }

  // Taken before any await, so two calls in flight never share a nonce. A failed
  // decrypt still spends one: the session ends on it anyway.
  params(ad) {
    const iv = new Uint8Array(12);
    new DataView(iv.buffer).setBigUint64(4, BigInt(this.n));
    this.n += 1;
    return { name: "AES-GCM", iv, additionalData: ad, tagLength: 128 };
  }

  async encrypt(ad, plain) {
    return new Uint8Array(await subtle.encrypt(this.params(ad), this.key, plain));
  }

  async decrypt(ad, sealed) {
    return new Uint8Array(await subtle.decrypt(this.params(ad), this.key, sealed));
  }
}

// The same list as MATCH_EMOJI in sharenoise.rs, in the same order.
const MATCH_EMOJI = [
  "🐶", "🐱", "🦁", "🐎", "🦄", "🐷", "🐘", "🐰", "🐼", "🐓", "🐧", "🐢", "🐟", "🐙", "🦋", "🌷",
  "🌳", "🌵", "🍄", "🌏", "🌙", "🌈", "🔥", "🍌", "🍎", "🍓", "🌽", "🍕", "🎂", "💎", "😀", "🤖",
  "🎩", "👓", "🔧", "🎅", "👍", "🎈", "⌛", "⏰", "🎁", "💡", "📕", "🍩", "📎", "🧲", "🔒", "🔑",
  "🔨", "📷", "🏁", "🚂", "🚲", "🚁", "🚀", "🏆", "⚽", "🎸", "🎺", "🔔", "⚓", "🎧", "📁", "📌",
];

// What both ends derive from the handshake, for the host to compare with what this
// page shows before letting the guest in: four emoji, or four digits on a host
// running lpm 0.7.26.
function matchCodes(hash) {
  const bits = (hash[0] << 16) | (hash[1] << 8) | hash[2];
  const n = new DataView(hash.buffer, hash.byteOffset).getUint32(0) % 10000;
  return {
    emoji: [18, 12, 6, 0].map((shift) => MATCH_EMOJI[(bits >> shift) & 63]).join(" "),
    digits: String(n).padStart(4, "0"),
  };
}

export class Session {
  constructor(send, receive, codes) {
    this.send = send;
    this.receive = receive;
    this.codes = codes;
    this.partial = [];
    this.size = 0;
  }

  // The Noise messages that carry `text`.
  async seal(text) {
    const bytes = encoder.encode(text);
    const count = Math.max(1, Math.ceil(bytes.length / PIECE));
    const out = [];
    for (let i = 0; i < count; i++) {
      const piece = bytes.subarray(i * PIECE, (i + 1) * PIECE);
      out.push(await this.send.encrypt(new Uint8Array(0), concat(Uint8Array.of(i === count - 1 ? 1 : 0), piece)));
    }
    return out;
  }

  // One Noise message in: the whole frame once its last piece has arrived.
  async open(message) {
    if (message.length <= TAG || message.length > 65535) throw new Error("bad message");
    const plain = await this.receive.decrypt(new Uint8Array(0), message);
    const flag = plain[0];
    if (flag !== 0 && flag !== 1) throw new Error("bad message");
    this.size += plain.length - 1;
    if (this.size > MAX_FRAME) throw new Error("frame too big");
    this.partial.push(plain.subarray(1));
    if (flag === 0) return null;
    const frame = decoder.decode(concat(...this.partial));
    this.partial = [];
    this.size = 0;
    return frame;
  }
}

// Start a session with the host whose public key the invite carries. `ephemeral`
// is for tests only.
export async function initiate(hostKey, room, ephemeral = null) {
  const name = encoder.encode(PROTOCOL);
  let h = new Uint8Array(32);
  h.set(name);
  let ck = h.slice();
  let cipher = null;
  const mixHash = async (data) => {
    h = await sha256(concat(h, data));
  };
  const mixKey = async (input) => {
    const [next, key] = await hkdf(ck, input);
    ck = next;
    cipher = await CipherState.of(key);
  };

  await mixHash(encoder.encode(PROLOGUE + room));
  await mixHash(hostKey);

  const e = ephemeral ?? (await subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]));
  const ePublic = new Uint8Array(await subtle.exportKey("raw", e.publicKey));
  await mixHash(ePublic);
  await mixKey(await dh(e.privateKey, hostKey));
  const sealed = await cipher.encrypt(h, new Uint8Array(0));
  await mixHash(sealed);

  return {
    first: concat(ePublic, sealed),
    async finish(reply) {
      if (reply.length !== DH_LEN + TAG) throw new Error("bad handshake");
      const re = reply.slice(0, DH_LEN);
      await mixHash(re);
      await mixKey(await dh(e.privateKey, re));
      const tail = reply.slice(DH_LEN);
      await cipher.decrypt(h, tail);
      await mixHash(tail);
      const [send, receive] = await hkdf(ck, new Uint8Array(0));
      return new Session(await CipherState.of(send), await CipherState.of(receive), matchCodes(h));
    },
  };
}
