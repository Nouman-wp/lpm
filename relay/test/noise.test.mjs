import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { initiate } from "../public/noise.js";

const vector = JSON.parse(readFileSync(new URL("./noise-vector.json", import.meta.url)));
const hex = (s) => Uint8Array.from(Buffer.from(s, "hex"));
const toHex = (b) => Buffer.from(b).toString("hex");

// An X25519 key from its 32 private bytes, as WebCrypto keys.
async function keyPair(privateHex) {
  const der = Buffer.concat([Buffer.from("302e020100300506032b656e04220420", "hex"), Buffer.from(privateHex, "hex")]);
  const raw = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" }))
    .export({ format: "der", type: "spki" })
    .subarray(-32);
  return {
    privateKey: await webcrypto.subtle.importKey("pkcs8", der, { name: "X25519" }, false, ["deriveBits"]),
    publicKey: await webcrypto.subtle.importKey("raw", raw, { name: "X25519" }, true, []),
    raw: new Uint8Array(raw),
  };
}

test("the browser's handshake and frames match the host's bytes", async () => {
  const host = await keyPair(vector.hostPrivate);
  const ephemeral = await keyPair(vector.guestEphemeral);
  const start = await initiate(host.raw, vector.room, ephemeral);
  assert.equal(toHex(start.first), vector.first);

  const session = await start.finish(hex(vector.reply));
  assert.equal(session.code, vector.code);

  const sealed = await session.seal(vector.guestFrame);
  assert.equal(sealed.length, 1);
  assert.equal(toHex(sealed[0]), vector.guestSealed);
  assert.equal(await session.open(hex(vector.hostSealed)), vector.hostFrame);
});

test("a reply from anyone but the host is refused", async () => {
  const host = await keyPair(vector.hostPrivate);
  const ephemeral = await keyPair(vector.guestEphemeral);
  const start = await initiate(host.raw, "BBBBBBBBBBBBBBBBBBBBBB", ephemeral);
  await assert.rejects(start.finish(hex(vector.reply)));
});

test("a big frame goes out in pieces", async () => {
  const host = await keyPair(vector.hostPrivate);
  const ephemeral = await keyPair(vector.guestEphemeral);
  const start = await initiate(host.raw, vector.room, ephemeral);
  const session = await start.finish(hex(vector.reply));
  const sealed = await session.seal("x".repeat(70 * 1024));
  assert.equal(sealed.length, 3);
  assert.ok(sealed.every((m) => m.length <= 65535));
});
