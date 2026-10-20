import { describe, expect, it } from "vitest";
import { machineEntries } from "./machineEntries";
import type { PeerClient } from "./usePeerState";

const peer = (slug: string, hostId?: string): PeerClient => ({
  slug,
  alias: slug,
  host: "10.0.0.2",
  port: 8766,
  hostId,
  enabled: true,
  connected: true,
});

describe("machineEntries", () => {
  it("lists a machine paired both ways once", () => {
    const entries = machineEntries([peer("studio", "h1")], [{ id: "d1", name: "Studio", hostId: "h1" }]);
    expect(entries).toEqual([{ key: "studio", peer: peer("studio", "h1"), device: { id: "d1", name: "Studio", hostId: "h1" } }]);
  });

  it("keeps each direction on its own row until the device reports who it is", () => {
    const entries = machineEntries([peer("studio", "h1")], [{ id: "d1", name: "Studio" }]);
    expect(entries.map((e) => e.key)).toEqual(["studio", "device:d1"]);
  });

  it("lists a machine that only opens this one after the ones this one opens", () => {
    const entries = machineEntries([peer("mini")], [{ id: "d2", name: "Air", hostId: "h2" }]);
    expect(entries.map((e) => [e.key, !!e.peer, !!e.device])).toEqual([
      ["mini", true, false],
      ["device:d2", false, true],
    ]);
  });

  it("gives a device to one peer only", () => {
    const entries = machineEntries([peer("a", "h1"), peer("b", "h1")], [{ id: "d1", name: "Twin", hostId: "h1" }]);
    expect(entries.map((e) => e.device?.id ?? null)).toEqual(["d1", null]);
  });
});
