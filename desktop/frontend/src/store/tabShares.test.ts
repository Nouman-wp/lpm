import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  peers: null as null | ((peers: { slug: string; alias: string }[]) => void),
  events: new Map<string, (slug: string, payload: unknown) => void>(),
  invoke: vi.fn(),
}));

vi.mock("../../bridge/commands", () => ({
  PeerInvoke: hooks.invoke,
  PeerShares: () => Promise.resolve([]),
  PeerJoinedShares: () => Promise.resolve([]),
}));
vi.mock("../../bridge/runtime", () => ({ EventsOn: () => () => {} }));
vi.mock("../peer/route", () => ({
  watchConnectedPeers: (cb: (peers: { slug: string; alias: string }[]) => void) => {
    hooks.peers = cb;
    return () => {};
  },
  subscribeEveryPeer: (name: string, cb: (slug: string, payload: unknown) => void) => {
    hooks.events.set(name, cb);
    return () => {};
  },
}));
vi.stubGlobal("window", {});

import {
  applyMachineShares,
  refreshMachineShares,
  useTabShares,
  watchTabShares,
  type HostedShare,
} from "./tabShares";

const SLUG = "abcdef12";

function row(id: string, terminalId: string, over: Partial<HostedShare> = {}): HostedShare {
  return {
    id,
    terminalId,
    project: "web",
    label: "claude",
    canType: false,
    invite: "lpm-share:x",
    guests: [],
    waiting: [],
    ...over,
  };
}

const sam = {
  id: "g1",
  name: "Sam",
  joinedAt: 1,
  connected: true,
  canType: true,
  via: "browser" as const,
  asked: false,
  typedAt: 0,
};

beforeEach(() => {
  hooks.invoke.mockReset();
  useTabShares.setState({ hosted: [], machineNames: {} });
});

describe("tabs shared from here on a paired machine", () => {
  it("are named as this machine names that machine's terminals, after its own shares", () => {
    useTabShares.getState().setHosted([row("a", "local-1")]);
    applyMachineShares(SLUG, [row("b", "pty-7")]);
    expect(useTabShares.getState().hosted.map((h) => [h.terminalId, h.machine])).toEqual([
      ["local-1", undefined],
      [`peer-${SLUG}-pty-7`, SLUG],
    ]);
    useTabShares.getState().setHosted([]);
    expect(useTabShares.getState().hosted.map((h) => h.id)).toEqual(["b"]);
  });

  it("are listed while the machine is connected and dropped once it isn't", async () => {
    hooks.invoke.mockResolvedValue([row("b", "pty-7")]);
    watchTabShares();
    hooks.peers?.([{ slug: SLUG, alias: "devbox" }]);
    await vi.waitFor(() => expect(useTabShares.getState().hosted).toHaveLength(1));
    expect(hooks.invoke).toHaveBeenCalledWith(SLUG, "peer_shares", {});
    expect(useTabShares.getState().machineNames).toEqual({ [SLUG]: "devbox" });

    hooks.peers?.([]);
    expect(useTabShares.getState().hosted).toEqual([]);
  });

  it("are listed again when the machine says they changed", async () => {
    watchTabShares();
    hooks.invoke.mockResolvedValue([row("b", "pty-7", { waiting: [{ id: "w1", name: "Ana" }] })]);
    hooks.events.get("peer-share-changed")?.(SLUG, null);
    await vi.waitFor(() => expect(useTabShares.getState().hosted[0]?.waiting).toHaveLength(1));
  });

  it("keep a command's answer over a listing asked for before it", async () => {
    let answer: (rows: unknown) => void = () => {};
    hooks.invoke.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const listing = refreshMachineShares(SLUG);
    applyMachineShares(SLUG, [row("b", "pty-7", { canType: true })]);
    answer([row("b", "pty-7")]);
    await listing;
    expect(useTabShares.getState().hosted[0].canType).toBe(true);
  });

  it("are none on a machine whose lpm can't share its tabs", async () => {
    applyMachineShares(SLUG, [row("b", "pty-7")]);
    hooks.invoke.mockRejectedValue("command not permitted over peer connection: peer_shares");
    await refreshMachineShares(SLUG);
    expect(useTabShares.getState().hosted).toEqual([]);
  });

  it("hear typing by this machine's clock", () => {
    watchTabShares();
    applyMachineShares(SLUG, [row("b", "pty-7", { guests: [sam] })]);
    const before = Date.now();
    hooks.events.get("peer-share-typed")?.(SLUG, { share: "b", guest: "g1", at: 5 });
    expect(useTabShares.getState().hosted[0].guests[0].typedAt).toBeGreaterThanOrEqual(before);
  });
});
