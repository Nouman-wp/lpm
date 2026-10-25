import { describe, expect, it } from "vitest";
import { decodeShareInvite, looksLikeShareInvite, phoneShareLink, shareLink, shortShareLink } from "./invite";
import { decodeInvite, fromBase64Url, toBase64Url } from "../peer/invite";

function encode(payload: unknown): string {
  return `lpm-share:${toBase64Url(JSON.stringify(payload))}`;
}

function phonePayload(link: string): Record<string, unknown> {
  expect(link.startsWith("https://lpm.cx/join#")).toBe(true);
  return JSON.parse(fromBase64Url(link.slice("https://lpm.cx/join#".length)) ?? "null");
}

const FULL = { v: 1, h: ["192.168.1.20", "100.64.0.5"], p: 8766, s: "c2VjcmV0", f: "ab".repeat(32) };
const RELAYED = {
  ...FULL,
  s: "s".repeat(32),
  n: "Ana's MacBook Pro",
  l: "claude",
  j: "web",
  u: "https://lpm-share-relay.lpm-share-relay.workers.dev",
  r: "r".repeat(22),
  k: "k".repeat(43),
};
// The most a QR code holds in bytes at the lowest error correction.
const VERSION_12_BYTES = 367;
const VERSION_13_BYTES = 425;

describe("share invite", () => {
  it("decodes what the host hands out", () => {
    expect(decodeShareInvite(encode(FULL))).toEqual({
      hosts: ["192.168.1.20", "100.64.0.5"],
      port: 8766,
      secret: "c2VjcmV0",
      fp: "ab".repeat(32),
      hostName: "",
      label: "",
      project: "",
    });
  });

  it("reads the names it greets with, printable and short", () => {
    const invite = decodeShareInvite(
      encode({ ...FULL, n: "Maya's MacBook Pro", l: "claude\u001b[2J", j: "x".repeat(100) }),
    );
    expect(invite?.hostName).toBe("Maya's MacBook Pro");
    expect(invite?.label).toBe("claude[2J");
    expect(invite?.project).toHaveLength(64);
    expect(decodeShareInvite(encode({ ...FULL, n: 7 }))?.hostName).toBe("");
  });

  it("shortens a link to its site and last few characters", () => {
    expect(shortShareLink("https://lpm.cx/join#eyJ2IjoxLCJoIjpbx7Kq")).toBe("lpm.cx/join#…x7Kq");
    expect(shortShareLink("https://lpm.cx/join")).toBe("lpm.cx/join");
  });

  it("tolerates whitespace from a paste", () => {
    expect(decodeShareInvite(`  ${encode(FULL)}\n`)).not.toBeNull();
  });

  it("refuses an invite without the host's fingerprint", () => {
    expect(decodeShareInvite(encode({ ...FULL, f: "" }))).toBeNull();
    const { f: _f, ...unpinned } = FULL;
    expect(decodeShareInvite(encode(unpinned))).toBeNull();
  });

  it("refuses incomplete or foreign payloads", () => {
    expect(decodeShareInvite(encode({ ...FULL, h: [] }))).toBeNull();
    expect(decodeShareInvite(encode({ ...FULL, p: 0 }))).toBeNull();
    expect(decodeShareInvite(encode({ ...FULL, s: "" }))).toBeNull();
    expect(decodeShareInvite(encode({ ...FULL, v: 2 }))).toBeNull();
    expect(decodeShareInvite("lpm-share:not base64!")).toBeNull();
    expect(decodeShareInvite("lpm-pair:abc")).toBeNull();
    expect(decodeShareInvite(42)).toBeNull();
  });

  it("is never mistaken for a pairing invite", () => {
    const s = encode(FULL);
    expect(looksLikeShareInvite(s)).toBe(true);
    expect(decodeInvite(s)).toBeNull();
  });

  it("travels as an lpm.cx link and opens through lpm://", () => {
    const invite = encode(FULL);
    const payload = invite.slice("lpm-share:".length);
    const link = shareLink(invite);
    expect(link).toBe(`https://lpm.cx/join#${payload}`);
    expect(shareLink(link)).toBe(link);
    for (const form of [link, `https://www.lpm.cx/join/#${payload}`, `lpm://join?i=${payload}`, `lpm://join/?x=1&i=${payload}`]) {
      expect(looksLikeShareInvite(form)).toBe(true);
      expect(decodeShareInvite(form)).toEqual(decodeShareInvite(invite));
    }
  });

  it("takes no other site's link or lpm:// link for one", () => {
    const payload = encode(FULL).slice("lpm-share:".length);
    expect(decodeShareInvite(`https://example.com/join#${payload}`)).toBeNull();
    expect(decodeShareInvite(`https://lpm.cx/mobile#${payload}`)).toBeNull();
    expect(decodeShareInvite(`lpm://pair?i=${payload}`)).toBeNull();
    expect(looksLikeShareInvite("https://lpm.cx/join#")).toBe(false);
  });

  it("gives a phone's camera only what the browser page reads", () => {
    const { v, s, u, r, k, n, l, j } = RELAYED;
    expect(phonePayload(phoneShareLink(encode(RELAYED)))).toEqual({ v, s, u, r, k, n, l, j });
  });

  it("cuts long names short in the phone's link", () => {
    const link = phoneShareLink(encode({ ...RELAYED, n: "a".repeat(64), l: "語".repeat(64), j: "" }));
    expect(phonePayload(link)).toMatchObject({ n: `${"a".repeat(21)}…`, l: `${"語".repeat(7)}…` });
    expect(phonePayload(link)).not.toHaveProperty("j");
  });

  it("keeps the whole link for a share without a relay", () => {
    const invite = encode(FULL);
    expect(phoneShareLink(invite)).toBe(shareLink(invite));
  });

  it("keeps the QR code small whatever the names", () => {
    expect(phoneShareLink(encode(RELAYED)).length).toBeLessThanOrEqual(VERSION_12_BYTES);
    const longest = encode({
      ...RELAYED,
      h: ["192.168.100.200", "100.100.100.100", "100.64.100.100"],
      n: "語".repeat(64),
      l: '"'.repeat(64),
      j: "語".repeat(64),
    });
    expect(phoneShareLink(longest).length).toBeLessThanOrEqual(VERSION_13_BYTES);
  });
});
