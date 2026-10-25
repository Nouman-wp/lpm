import { test } from "node:test";
import assert from "node:assert/strict";
import { newRecapId, RECAP_ID, recapPngProblem } from "../src/recapPng.ts";

function png(width, height, size = 64) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set([..."IHDR"].map((c) => c.charCodeAt(0)), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test("takes lpm's recap card", () => {
  assert.equal(recapPngProblem(png(1200, 862)), null);
});

test("turns away anything else", () => {
  assert.equal(recapPngProblem(png(1024, 862)), "not a recap card");
  assert.equal(recapPngProblem(png(1200, 12000)), "not a recap card");
  assert.equal(recapPngProblem(new TextEncoder().encode("GIF89a and then some more bytes here")), "not a PNG");
  assert.equal(recapPngProblem(png(1200, 862, 1600 * 1024)), "too large");
});

test("names each card with a fresh link-safe id", () => {
  const ids = new Set(Array.from({ length: 200 }, newRecapId));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, RECAP_ID);
});
