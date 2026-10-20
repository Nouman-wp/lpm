import { test } from "node:test";
import assert from "node:assert/strict";
import { roomOf } from "../src/claim.ts";

// The same vector as room_of in desktop/frontend/src-tauri/src/sharerelay.rs.
test("a token names its room the way lpm does", async () => {
  assert.equal(await roomOf("abc"), "ungWv48Bz-pBQUDeXa4iIw");
});

test("a room name fits the relay's room paths", async () => {
  assert.match(await roomOf("any host token at all"), /^[A-Za-z0-9_-]{22}$/);
});
