import { describe, it, expect, beforeEach } from "vitest";
import {
  isPendingClose,
  pendingClosesForProject,
  pendingPaneClosesForProject,
  registerPendingClose,
  registerPendingPaneClose,
  takePendingClose,
  takePendingPaneClose,
  type PendingClose,
} from "./pendingClose";
import { makePaneLeaf, type TerminalInstance } from "./paneTree";

function tab(id: string, label = id): TerminalInstance {
  return { id, label };
}

function entry(id: string, project = "proj"): PendingClose {
  return {
    tab: tab(id),
    paneId: "pane-1",
    tabIdx: 0,
    projectName: project,
    toastId: `close-tab-${id}`,
    finalized: false,
  };
}

// The registry is module-global; drain it between tests so cases don't bleed.
beforeEach(() => {
  for (const p of pendingPaneClosesForProject("proj")) takePendingPaneClose(p.pane.id);
  for (const p of pendingClosesForProject("proj")) takePendingClose(p.tab.id);
  for (const p of pendingClosesForProject("other")) takePendingClose(p.tab.id);
});

describe("pendingClose registry", () => {
  it("reports membership after register", () => {
    expect(isPendingClose("t1")).toBe(false);
    registerPendingClose(entry("t1"));
    expect(isPendingClose("t1")).toBe(true);
  });

  it("take removes the entry so it can only be claimed once", () => {
    registerPendingClose(entry("t1"));
    const first = takePendingClose("t1");
    expect(first?.tab.id).toBe("t1");
    expect(isPendingClose("t1")).toBe(false);
    expect(takePendingClose("t1")).toBeUndefined();
  });

  it("take of an unknown id is a no-op", () => {
    expect(takePendingClose("missing")).toBeUndefined();
  });

  it("preserves the captured restore location", () => {
    const e = entry("t1");
    e.paneId = "pane-42";
    e.tabIdx = 3;
    registerPendingClose(e);
    const taken = takePendingClose("t1");
    expect(taken?.paneId).toBe("pane-42");
    expect(taken?.tabIdx).toBe(3);
  });

  it("scopes listing by project", () => {
    registerPendingClose(entry("a", "proj"));
    registerPendingClose(entry("b", "proj"));
    registerPendingClose(entry("c", "other"));
    expect(pendingClosesForProject("proj").map((e) => e.tab.id).sort()).toEqual(["a", "b"]);
    expect(pendingClosesForProject("other").map((e) => e.tab.id)).toEqual(["c"]);
  });
});

describe("pending pane close", () => {
  const pane = makePaneLeaf("pane-7", [tab("a"), tab("b")], 1);

  function registerPane() {
    registerPendingPaneClose({ pane, spot: null, projectName: "proj", toastId: "close-pane-pane-7" });
  }

  it("holds every tab of the pane under the pane's toast", () => {
    registerPane();
    expect(isPendingClose("a")).toBe(true);
    expect(isPendingClose("b")).toBe(true);
    expect(pendingClosesForProject("proj").map((e) => [e.tab.id, e.tabIdx, e.toastId])).toEqual([
      ["a", 0, "close-pane-pane-7"],
      ["b", 1, "close-pane-pane-7"],
    ]);
  });

  it("take claims the pane and releases its tabs, once", () => {
    registerPane();
    expect(takePendingPaneClose("pane-7")?.pane).toBe(pane);
    expect(isPendingClose("a")).toBe(false);
    expect(isPendingClose("b")).toBe(false);
    expect(pendingPaneClosesForProject("proj")).toEqual([]);
    expect(takePendingPaneClose("pane-7")).toBeUndefined();
  });
});
