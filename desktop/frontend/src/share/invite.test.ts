import { describe, expect, it } from "vitest";
import { decodeShareInvite, looksLikeShareInvite, shareLink } from "./invite";
import { decodeInvite } from "../peer/invite";

function encode(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `lpm-share:${b64}`;
}

const FULL = { v: 1, h: ["192.168.1.20", "100.64.0.5"], p: 8766, s: "c2VjcmV0", f: "ab".repeat(32) };

describe("share invite", () => {
  it("decodes what the host hands out", () => {
    expect(decodeShareInvite(encode(FULL))).toEqual({
      hosts: ["192.168.1.20", "100.64.0.5"],
      port: 8766,
      secret: "c2VjcmV0",
      fp: "ab".repeat(32),
    });
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
});
