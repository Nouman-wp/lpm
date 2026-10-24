import { describe, it, expect } from "vitest";
import { closePaneTooltip, paneClosedMessage, runningAgentCount } from "./paneCloseSummary";
import { makeTerminal, type TerminalInstance } from "./paneTree";

function tabs(n: number, opts?: { pinned?: boolean }): TerminalInstance[] {
  return Array.from({ length: n }, (_, i) => makeTerminal(`t${i}`, `Tab ${i}`, opts));
}

describe("runningAgentCount", () => {
  it("counts the pane's tabs whose agent is working", () => {
    expect(runningAgentCount(tabs(3), new Set(["t0", "t2", "other"]))).toBe(2);
    expect(runningAgentCount(tabs(3), undefined)).toBe(0);
  });
});

describe("closePaneTooltip", () => {
  it("stays plain for one idle tab or none", () => {
    expect(closePaneTooltip(tabs(1), 0)).toBe("Close pane");
    expect(closePaneTooltip([], 0)).toBe("Close pane");
  });

  it("names the tabs and the agents running in them", () => {
    expect(closePaneTooltip(tabs(3), 2)).toBe("Close pane and 3 tabs (2 agents running)");
    expect(closePaneTooltip(tabs(3), 1)).toBe("Close pane and 3 tabs (1 agent running)");
    expect(closePaneTooltip(tabs(2), 0)).toBe("Close pane and 2 tabs");
  });

  it("warns about a lone tab that is pinned or busy", () => {
    expect(closePaneTooltip(tabs(1, { pinned: true }), 0)).toBe("Close pane and 1 tab");
    expect(closePaneTooltip(tabs(1), 1)).toBe("Close pane and 1 tab (1 agent running)");
  });
});

describe("paneClosedMessage", () => {
  it("counts tabs and running agents", () => {
    expect(paneClosedMessage(tabs(3), 2)).toEqual({ title: "Pane closed", detail: "3 tabs, 2 agents running" });
    expect(paneClosedMessage(tabs(3), 0)).toEqual({ title: "Pane closed", detail: "3 tabs" });
  });

  it("reads like a tab close for a pane of one tab", () => {
    expect(paneClosedMessage(tabs(1), 0)).toEqual({ title: "Tab 0 closed", detail: undefined });
    expect(paneClosedMessage(tabs(1), 1)).toEqual({ title: "Tab 0 closed", detail: "agent running" });
  });

  it("has nothing to count in a pane with no tabs", () => {
    expect(paneClosedMessage([], 0)).toEqual({ title: "Pane closed" });
  });
});
