import { test } from "node:test";
import assert from "node:assert/strict";
import { hostSize, MAX_COLS, MAX_ROWS } from "../public/size.js";

// The size a shared tab's host reports comes from someone this page never
// trusted, and xterm.js allocates every cell of it.
test("a huge size is drawn at the most a screen holds", () => {
  assert.deepEqual(hostSize(65535, 65535), { cols: MAX_COLS, rows: MAX_ROWS });
  assert.deepEqual(hostSize(1e9, 40), { cols: MAX_COLS, rows: 40 });
});

test("a real host's size passes through", () => {
  assert.deepEqual(hostSize(1250, 340), { cols: 1250, rows: 340 });
  assert.deepEqual(hostSize(80, 24), { cols: 80, rows: 24 });
});

// xterm.js throws on these, and the page would reconnect for good.
test("a size no host sends is ignored", () => {
  for (const [cols, rows] of [[0, 24], [-5, 24], [1.5, 24], ["80", 24], [Infinity, 24], [undefined, 24], [80, null]]) {
    assert.equal(hostSize(cols, rows), null, `${cols}×${rows}`);
  }
});
