import { describe, expect, it } from "vitest";
import { paneOrderFollowing } from "./remoteTabOrder";

describe("paneOrderFollowing", () => {
  it("takes the order of the tabs the list names", () => {
    expect(paneOrderFollowing(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("keeps a tab the list leaves out in its place", () => {
    expect(paneOrderFollowing(["a", "web", "b", "c"], ["c", "b", "a"])).toEqual(["c", "web", "b", "a"]);
  });

  it("reorders a pane by the terminals it holds, whatever else the list names", () => {
    expect(paneOrderFollowing(["b", "a"], ["x", "a", "y", "b"])).toEqual(["a", "b"]);
  });

  it("says when nothing moves", () => {
    expect(paneOrderFollowing(["a", "b"], ["a", "b"])).toBeNull();
    expect(paneOrderFollowing(["a", "web"], ["a"])).toBeNull();
  });
});
