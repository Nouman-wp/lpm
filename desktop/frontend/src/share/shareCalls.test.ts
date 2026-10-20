import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  invoke: vi.fn(),
  state: vi.fn(),
  start: vi.fn(),
  routed: vi.fn(),
}));

vi.mock("../../bridge/commands", () => ({
  PeerInvoke: hooks.invoke,
  PeerState: hooks.state,
  PeerShareStart: hooks.start,
  PeerShares: () => Promise.resolve([]),
  PeerJoinedShares: () => Promise.resolve([]),
}));
vi.mock("../../bridge/runtime", () => ({ EventsOn: () => () => {} }));
vi.mock("../peer/route", () => ({
  routedInvoke: hooks.routed,
  watchConnectedPeers: () => () => {},
  subscribeEveryPeer: () => () => {},
}));

import { useTabShares, type HostedShare, type ShareTarget } from "../store/tabShares";
import { respondToJoin, startShare, stopShare } from "./shareCalls";

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

function target(terminalId: string): ShareTarget {
  return { terminalId, project: "web", label: "claude", anchor: { left: 0, top: 0, right: 0, bottom: 0 } };
}

function peer(over: Record<string, unknown> = {}) {
  return { peers: [{ slug: SLUG, alias: "devbox", connected: true, supportsTabShare: true, ...over }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  useTabShares.setState({ hosted: [], machineNames: {} });
});

describe("sharing a tab on a paired machine", () => {
  it("shares it there, by the id that machine knows it by", async () => {
    hooks.state.mockResolvedValue(peer());
    hooks.invoke.mockResolvedValue([row("b", "pty-7")]);
    const made = await startShare(target(`peer-${SLUG}-pty-7`), "web");
    expect(hooks.invoke).toHaveBeenCalledWith(SLUG, "peer_share_start", {
      terminalId: "pty-7",
      project: "web",
      label: "claude",
    });
    expect(made?.terminalId).toBe(`peer-${SLUG}-pty-7`);
    expect(useTabShares.getState().hosted).toHaveLength(1);
  });

  it("asks for a newer lpm there before trying", async () => {
    hooks.state.mockResolvedValue(peer({ supportsTabShare: false }));
    await expect(startShare(target(`peer-${SLUG}-pty-7`), "web")).rejects.toThrow(
      "Update lpm on devbox to share its tabs.",
    );
    expect(hooks.invoke).not.toHaveBeenCalled();
  });

  it("changes a share on the machine that holds it", async () => {
    const share = { ...row("b", `peer-${SLUG}-pty-7`), machine: SLUG };
    useTabShares.getState().setMachineHosted(SLUG, [share]);
    hooks.invoke.mockResolvedValue([]);
    await stopShare(share);
    expect(hooks.invoke).toHaveBeenCalledWith(SLUG, "peer_share_stop", { id: "b" });
    expect(useTabShares.getState().hosted).toEqual([]);
  });

  it("leaves this machine's own shares to this machine", async () => {
    const share = row("a", "local-1", { waiting: [{ id: "w1", name: "Ana" }] });
    useTabShares.getState().setHosted([share]);
    hooks.routed.mockResolvedValue([row("a", "local-1")]);
    await respondToJoin(share, "w1", true);
    expect(hooks.routed).toHaveBeenCalledWith("peer_share_respond", { request: "w1", allow: true, canType: undefined });
    expect(hooks.invoke).not.toHaveBeenCalled();
    expect(useTabShares.getState().hosted[0].waiting).toEqual([]);
  });
});
