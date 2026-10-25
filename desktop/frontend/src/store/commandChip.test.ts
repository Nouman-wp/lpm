import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hideCommandChip,
  hoverCommand,
  keepCommandChip,
  leaveCommand,
  leaveCommandChip,
  useCommandChip,
  type CommandChipTarget,
} from "./commandChip";

const anchor = { endLeft: 300, endTop: 400, startLeft: 120, startTop: 400, rowHeight: 18, right: 1200 };
const target: CommandChipTarget = { key: "t1:3:1:npm test", terminalId: "t1", command: "npm test", risk: null, anchor, armed: false };

beforeEach(() => {
  vi.useFakeTimers();
  hoverCommand(target);
  vi.advanceTimersByTime(200);
});

afterEach(() => {
  hideCommandChip();
  vi.useRealTimers();
});

describe("command chip", () => {
  it("shows after a short hover", () => {
    expect(useCommandChip.getState().chip).toBe(target);
  });

  it("hides once the pointer leaves the command", () => {
    leaveCommand();
    vi.advanceTimersByTime(300);
    expect(useCommandChip.getState().chip).toBeNull();
  });

  it("stays while the pointer is on it, though its enter comes before the terminal's leave", () => {
    keepCommandChip();
    leaveCommand();
    vi.advanceTimersByTime(1000);
    expect(useCommandChip.getState().chip).toBe(target);

    leaveCommandChip();
    vi.advanceTimersByTime(300);
    expect(useCommandChip.getState().chip).toBeNull();
  });
});
