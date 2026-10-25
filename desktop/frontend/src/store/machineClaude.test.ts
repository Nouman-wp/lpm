import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  peers: null as null | ((peers: { slug: string; alias: string }[]) => void),
  events: new Map<string, (slug: string, payload: unknown) => void>(),
  read: vi.fn(),
  invoke: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../notifications/toast", () => ({ toast: Object.assign(hooks.toast, { error: vi.fn() }) }));
vi.mock("../../bridge/commands", () => ({ PeerInvoke: hooks.invoke }));
vi.mock("../../bridge/runtime", () => ({ EventsOn: () => () => {} }));
vi.mock("./settings", () => ({ useSettingsStore: { subscribe: () => () => {} } }));
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
vi.mock("../peer/hostClaude", async (original) => ({
  ...(await original<typeof import("../peer/hostClaude")>()),
  readHostClaude: hooks.read,
}));

import type { MachineClaudeAccounts } from "../peer/hostClaude";
import type { ClaudePool } from "./claudePool";
import { useMachineClaudeStore } from "./machineClaude";

const SLUG = "abcdef12";

const pool = (over: Partial<ClaudePool> = {}): ClaudePool => ({
  enabled: true,
  active: true,
  mode: "ask",
  consented: true,
  unavailable: null,
  paused: null,
  held: null,
  switchAt: 90,
  maxMembers: 3,
  main: ["default", "work"],
  allowed: [],
  accounts: [],
  pools: [
    { key: "__main__", project: null, members: ["default", "work"], current: "default", pick: null },
  ],
  ...over,
});

const machine = (over: Partial<MachineClaudeAccounts> = {}): MachineClaudeAccounts => ({
  accounts: [{ id: "work", label: "Work" }],
  statuses: {},
  usage: {},
  pool: pool(),
  ...over,
});

beforeEach(() => {
  useMachineClaudeStore.setState({ machines: {}, aliases: {}, dismissed: {} });
  hooks.read.mockReset();
  hooks.invoke.mockReset();
  hooks.toast.mockReset();
});

describe("a connected machine's Claude accounts", () => {
  it("are read when it connects and dropped when it goes", async () => {
    hooks.read.mockResolvedValue(machine());
    hooks.peers?.([{ slug: SLUG, alias: "Studio" }]);
    await vi.waitFor(() => expect(useMachineClaudeStore.getState().machines[SLUG]).toBeDefined());
    expect(useMachineClaudeStore.getState().aliases).toEqual({ [SLUG]: "Studio" });

    hooks.peers?.([]);
    expect(useMachineClaudeStore.getState().machines).toEqual({});
  });

  // Settings reads the machine again whenever its accounts change, so a re-read
  // that hands back equal accounts must not look like a change.
  it("keep what a re-read didn't change", async () => {
    const first = machine();
    useMachineClaudeStore.setState({ machines: { [SLUG]: first } });
    hooks.read.mockResolvedValue(machine());
    const again = await useMachineClaudeStore.getState().load(SLUG);
    expect(again.accounts).toBe(first.accounts);
    expect(again.pool).toBe(first.pool);
  });

  it("follow the pool changes it forwards, named as this Mac names its projects", () => {
    useMachineClaudeStore.setState({ machines: { [SLUG]: machine() } });
    const raw = pool({
      pools: [{ key: "project:web", project: "web", members: ["work"], current: "work", pick: null }],
    });
    hooks.events.get("claude-pool-changed")?.(SLUG, raw);
    expect(useMachineClaudeStore.getState().machines[SLUG].pool?.pools[0].project).toBe(`peer-${SLUG}-web`);
  });

  it("say on which machine an automatic switch happened", () => {
    useMachineClaudeStore.setState({ machines: { [SLUG]: machine() }, aliases: { [SLUG]: "Studio" } });
    hooks.events.get("claude-account-switched")?.(SLUG, {
      key: "__main__",
      project: null,
      from: "default",
      to: "work",
      pick: { id: "work", kind: "first", skipped: [] },
    });
    expect(hooks.toast).toHaveBeenCalledWith("New Claude sessions on Studio now use Work", expect.anything());
  });

  it("take a suggestion there, and put one off here", async () => {
    const suggesting = pool({
      pools: [
        {
          key: "__main__",
          project: null,
          members: ["default", "work"],
          current: "default",
          pick: { id: "work", kind: "first", skipped: [] },
        },
      ],
    });
    useMachineClaudeStore.setState({ machines: { [SLUG]: machine({ pool: suggesting }) } });

    useMachineClaudeStore.getState().dismiss(SLUG, "__main__");
    expect(useMachineClaudeStore.getState().dismissed).toEqual({ [SLUG]: { __main__: "default>work" } });

    hooks.invoke.mockResolvedValue(pool());
    await useMachineClaudeStore.getState().accept(SLUG, "__main__");
    expect(hooks.invoke).toHaveBeenCalledWith(SLUG, "accept_claude_pool_pick", { key: "__main__" });
    expect(useMachineClaudeStore.getState().machines[SLUG].pool?.pools[0].pick).toBeNull();
  });
});
