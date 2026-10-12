import { describe, it, expect } from "vitest";
import {
  hostClosedTabs,
  parseHostListing,
  releasePeerTerminal,
  beginPeerStart,
  claimPeerTerminal,
  endPeerStart,
  isPeerStartInFlight,
  unclaimedHostTerminals,
} from "./hostTerminals";
import { prefixName } from "./markers";

const A = "aaaaaaaa";
const B = "bbbbbbbb";

describe("unclaimedHostTerminals", () => {
  it("lists a host terminal this Mac has no tab for", () => {
    const id = prefixName(A, "lpm-1");
    expect(unclaimedHostTerminals([{ id, label: "Claude Code", pinned: true, emoji: "🤖" }], [])).toEqual(
      [{ id, label: "Claude Code", pinned: true, emoji: "🤖" }],
    );
  });

  it("skips the tabs open here", () => {
    const open = prefixName(A, "lpm-2");
    const other = prefixName(A, "lpm-3");
    const listed = [{ id: open }, { id: other }];
    expect(unclaimedHostTerminals(listed, [open]).map((t) => t.id)).toEqual([other]);
  });

  // The host still lists a tab closed here until its stop lands.
  it("never brings back a tab that was open here once", () => {
    const id = prefixName(A, "lpm-4");
    unclaimedHostTerminals([], [id]);
    expect(unclaimedHostTerminals([{ id }], [])).toEqual([]);
  });

  it("skips a terminal this Mac started", () => {
    const id = prefixName(A, "lpm-5");
    claimPeerTerminal(id);
    expect(unclaimedHostTerminals([{ id }], [])).toEqual([]);
  });

  it("drops the host's id-as-label fallback", () => {
    const id = prefixName(A, "lpm-6");
    expect(unclaimedHostTerminals([{ id, label: "lpm-6", emoji: "" }], [])).toEqual([
      { id, label: undefined, pinned: false, emoji: undefined },
    ]);
  });

  it("ignores unmarked ids and a malformed listing", () => {
    expect(unclaimedHostTerminals([{ id: "lpm-7" }, null, "x"], [])).toEqual([]);
    expect(unclaimedHostTerminals(null, [])).toEqual([]);
  });
});

describe("peer starts in flight", () => {
  it("counts overlapping starts per host", () => {
    beginPeerStart(B);
    beginPeerStart(B);
    endPeerStart(B);
    expect(isPeerStartInFlight(B)).toBe(true);
    expect(isPeerStartInFlight(A)).toBe(false);
    endPeerStart(B);
    expect(isPeerStartInFlight(B)).toBe(false);
  });
});

describe("parseHostListing", () => {
  it("reads a host that lists terminals only", () => {
    expect(parseHostListing([{ id: "x" }])).toEqual({ terminals: [{ id: "x" }], tabs: null, run: null });
  });

  it("reads the open tabs and run alongside", () => {
    expect(parseHostListing({ terminals: [], tabs: ["a", 3, "b"], run: "r1" })).toEqual({
      terminals: [],
      tabs: ["a", "b"],
      run: "r1",
    });
  });
});

describe("hostClosedTabs", () => {
  const listing = (tabs: string[] | null, run = "r1") => ({ terminals: [], tabs, run });

  it("closes a tab the host listed and no longer does", () => {
    const seen = { run: null, ids: new Set<string>() };
    expect(hostClosedTabs(seen, listing(["a", "b"]), ["a", "b"])).toEqual([]);
    expect(hostClosedTabs(seen, listing(["a"]), ["a", "b"])).toEqual(["b"]);
  });

  it("leaves a tab the host has not listed yet", () => {
    const seen = { run: null, ids: new Set<string>() };
    expect(hostClosedTabs(seen, listing(["a"]), ["a", "mine"])).toEqual([]);
  });

  it("closes nothing for a host that doesn't report its tabs", () => {
    const seen = { run: "r1", ids: new Set(["a"]) };
    expect(hostClosedTabs(seen, listing(null), ["a"])).toEqual([]);
  });

  it("keeps the tabs of terminals that ended with a host restart", () => {
    const seen = { run: null, ids: new Set<string>() };
    hostClosedTabs(seen, listing(["a"], "r1"), ["a"]);
    expect(hostClosedTabs(seen, listing(["fresh"], "r2"), ["a", "fresh"])).toEqual([]);
    expect(hostClosedTabs(seen, listing([], "r2"), ["a", "fresh"])).toEqual(["fresh"]);
  });
});

describe("releasePeerTerminal", () => {
  it("lets a sync open a tab the host closed and then reopened", () => {
    const id = prefixName(A, "undone-1");
    expect(unclaimedHostTerminals([{ id }], [id])).toEqual([]);
    releasePeerTerminal(id);
    expect(unclaimedHostTerminals([{ id }], []).map((t) => t.id)).toEqual([id]);
  });
});
