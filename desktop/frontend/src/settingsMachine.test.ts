import { describe, expect, it } from "vitest";
import type { PeerClient } from "./peer/usePeerState";
import { isOnMachine, LOCAL_MACHINE, peerMachine, reaches, type PeerMachine } from "./settingsMachine";

function peer(fields: Partial<PeerClient> = {}): PeerClient {
  return {
    slug: "aabbccdd",
    alias: "Studio",
    host: "10.0.0.2",
    port: 8766,
    enabled: true,
    connected: true,
    ...fields,
  };
}

const macPeer = peerMachine(peer({ platform: "macos" }));
const server = peerMachine(peer({ platform: "linux", headless: true }));
const linuxDesktop = peerMachine(peer({ platform: "linux", headless: false }));

describe("peerMachine", () => {
  it("names the machine by its alias, or its address without one", () => {
    expect(macPeer.name).toBe("Studio");
    expect(peerMachine(peer({ alias: "" })).name).toBe("10.0.0.2");
  });

  it("knows a server has nobody at it", () => {
    expect(server.attended).toBe(false);
    expect(macPeer.attended).toBe(true);
    expect(linuxDesktop.attended).toBe(true);
  });

  it("takes a machine's own word on whether it runs headless", () => {
    expect(peerMachine(peer({ platform: "macos", headless: true })).attended).toBe(false);
    expect(peerMachine(peer({ platform: "linux", headless: false })).attended).toBe(true);
  });

  it("takes an entry too old to report its platform for a Mac", () => {
    expect(peerMachine(peer()).mac).toBe(true);
    expect(linuxDesktop.mac).toBe(false);
  });
});

describe("reaches", () => {
  it("shows every row on this machine", () => {
    expect(reaches(LOCAL_MACHINE, undefined)).toBe(true);
    expect(reaches(LOCAL_MACHINE, "sameKeyboard", false)).toBe(true);
  });

  it("keeps rows that are this machine's alone off connected ones", () => {
    expect(reaches(macPeer, undefined)).toBe(false);
  });

  it("leaves how a screen looks and sounds off a machine nobody sits at", () => {
    expect(reaches(server, "any")).toBe(true);
    expect(reaches(server, "attended")).toBe(false);
    expect(reaches(macPeer, "attended")).toBe(true);
  });

  it("offers shortcuts only on a machine with the same kind of keyboard", () => {
    expect(reaches(macPeer, "sameKeyboard", true)).toBe(true);
    expect(reaches(linuxDesktop, "sameKeyboard", true)).toBe(false);
    expect(reaches(linuxDesktop, "sameKeyboard", false)).toBe(true);
    expect(reaches(server, "sameKeyboard", false)).toBe(false);
  });
});

describe("isOnMachine", () => {
  const studio: PeerMachine = macPeer;

  it("tells this machine's projects from a connected one's", () => {
    expect(isOnMachine("web", LOCAL_MACHINE)).toBe(true);
    expect(isOnMachine("peer-aabbccdd-web", LOCAL_MACHINE)).toBe(false);
    expect(isOnMachine("peer-aabbccdd-web", studio)).toBe(true);
    expect(isOnMachine("peer-11223344-web", studio)).toBe(false);
    expect(isOnMachine("web", studio)).toBe(false);
  });
});
