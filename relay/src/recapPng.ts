// What a weekly recap card upload must be: lpm's own card, a PNG exactly as
// wide as lpm draws it and no larger than one, so the endpoint can't be used to
// host anything else.
export const RECAP_MAX_BYTES = 1536 * 1024;
export const RECAP_WIDTH = 1200;
export const RECAP_MIN_HEIGHT = 400;
export const RECAP_MAX_HEIGHT = 2000;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ID_LENGTH = 12;
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const RECAP_ID = /^[A-Za-z0-9]{12}$/;

/** Why `bytes` isn't a recap card, or null when it is one. */
export function recapPngProblem(bytes: Uint8Array): string | null {
  if (bytes.length > RECAP_MAX_BYTES) return "too large";
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return "not a PNG";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk !== "IHDR") return "not a PNG";
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== RECAP_WIDTH || height < RECAP_MIN_HEIGHT || height > RECAP_MAX_HEIGHT) {
    return "not a recap card";
  }
  return null;
}

/** A fresh, unguessable id for a card's link. */
export function newRecapId(): string {
  let id = "";
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH))) {
      // 248 = 4 × 62: anything above would favour the first letters.
      if (byte < 248 && id.length < ID_LENGTH) id += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
  }
  return id;
}
