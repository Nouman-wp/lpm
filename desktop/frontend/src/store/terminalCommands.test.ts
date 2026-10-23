import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../bridge/runtime", () => ({ EventsOn: () => () => {} }));

import { NAME_AFTER_MS, applyTerminalCommandEvent, useTerminalCommands } from "./terminalCommands";

const state = () => useTerminalCommands.getState().byId.t1;

beforeEach(() => {
  vi.useFakeTimers();
  useTerminalCommands.setState({ byId: {} });
});

afterEach(() => vi.useRealTimers());

describe("terminal commands", () => {
  it("names the tab only once the command has run a moment", () => {
    applyTerminalCommandEvent({ id: "t1", command: "pnpm test", at: 1000 });
    expect(state().running).toEqual({ command: "pnpm test", since: 1000, named: false });
    vi.advanceTimersByTime(NAME_AFTER_MS);
    expect(state().running?.named).toBe(true);
  });

  it("records how the command ended and for how long it ran", () => {
    applyTerminalCommandEvent({ id: "t1", command: "pnpm lint", at: 1000 });
    applyTerminalCommandEvent({ id: "t1", code: 1, at: 4000 });
    expect(state()).toEqual({ last: { command: "pnpm lint", code: 1, ms: 3000, at: 4000 } });
    vi.advanceTimersByTime(NAME_AFTER_MS);
    expect(state().running).toBeUndefined();
  });

  it("ignores the prompt that comes before any command", () => {
    applyTerminalCommandEvent({ id: "t1", code: 0, at: 1000 });
    expect(state()).toBeUndefined();
  });

  it("keeps the last result while the next command runs", () => {
    applyTerminalCommandEvent({ id: "t1", command: "make", at: 0 });
    applyTerminalCommandEvent({ id: "t1", code: 2, at: 5000 });
    applyTerminalCommandEvent({ id: "t1", command: "make", at: 6000 });
    expect(state().last?.code).toBe(2);
    expect(state().running?.since).toBe(6000);
  });
});
