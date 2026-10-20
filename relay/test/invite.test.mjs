import { test } from "node:test";
import assert from "node:assert/strict";
import { readInvite } from "../public/invite.js";

const ROOM = "AAAAAAAAAAAAAAAAAAAAAA";
const KEY = Buffer.alloc(32).toString("base64url");
const RELAY = { u: "https://relay.example", r: ROOM, k: KEY };
const NETWORK = { v: 1, h: ["10.0.0.2"], p: 8766, s: "sekret", f: "ab12" };

const hash = (payload) => `#${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;

test("an invite greets with the host, tab and project it names", () => {
  const invite = readInvite(
    hash({ ...NETWORK, n: "Maya's MacBook Pro", l: "Claude Code", j: "storefront", ...RELAY }),
  );
  assert.equal(invite.secret, "sekret");
  assert.equal(invite.room, ROOM);
  assert.equal(invite.key.length, 32);
  assert.equal(invite.hostName, "Maya's MacBook Pro");
  assert.equal(invite.label, "Claude Code");
  assert.equal(invite.project, "storefront");
});

test("names lose control characters, as lpm strips them", () => {
  const invite = readInvite(
    hash({ ...NETWORK, n: "Maya\u0000\u0007's\u009b", l: "claude\u001b[2J", j: "web\r\n", ...RELAY }),
  );
  assert.equal(invite.hostName, "Maya's");
  assert.equal(invite.label, "claude[2J");
  assert.equal(invite.project, "web");
});

test("names stop at 64 characters, counted as lpm counts them", () => {
  const invite = readInvite(hash({ ...NETWORK, n: "x".repeat(100), l: "🦁".repeat(70), ...RELAY }));
  assert.equal(invite.hostName, "x".repeat(64));
  assert.equal(invite.label, "🦁".repeat(64));
});

test("an invite from an lpm that names nothing still opens", () => {
  const invite = readInvite(hash({ ...NETWORK, ...RELAY }));
  assert.equal(invite.secret, "sekret");
  assert.deepEqual([invite.hostName, invite.label, invite.project], ["", "", ""]);
  const odd = readInvite(hash({ ...NETWORK, n: 5, l: null, j: { a: 1 }, ...RELAY }));
  assert.deepEqual([odd.hostName, odd.label, odd.project], ["", "", ""]);
});

test("an invite without the relay's fields opens only in lpm", () => {
  assert.equal(readInvite(hash(NETWORK)), "network");
  assert.equal(readInvite(hash({ ...NETWORK, n: "Maya's MacBook Pro", l: "Claude Code" })), "network");
});

test("anything else isn't an invite", () => {
  const garbage = [
    "",
    "#",
    "#not base64!",
    `#${Buffer.from("not json").toString("base64url")}`,
    hash(null),
    hash({ ...NETWORK, v: 2, ...RELAY }),
    hash({ ...NETWORK, s: "", ...RELAY }),
    hash({ ...NETWORK, ...RELAY, r: "short" }),
    hash({ ...NETWORK, ...RELAY, k: Buffer.alloc(16).toString("base64url") }),
  ];
  for (const h of garbage) assert.equal(readInvite(h), null, h);
});
