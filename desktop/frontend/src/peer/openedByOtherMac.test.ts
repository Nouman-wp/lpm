import { afterEach, describe, expect, it, vi } from "vitest";
import { noteOpenedByOtherMac, openedByOtherMacJustNow } from "./openedByOtherMac";

describe("openedByOtherMacJustNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false for a tab this Mac opened itself", () => {
    expect(openedByOtherMacJustNow("peer-aaaaaaaa-own-1")).toBe(false);
  });

  it("holds for every check in the moment after the other Mac opened it", () => {
    vi.useFakeTimers();
    noteOpenedByOtherMac("peer-aaaaaaaa-new-1");
    expect(openedByOtherMacJustNow("peer-aaaaaaaa-new-1")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(openedByOtherMacJustNow("peer-aaaaaaaa-new-1")).toBe(true);
  });

  it("lets a tab shown later be claimed", () => {
    vi.useFakeTimers();
    noteOpenedByOtherMac("peer-aaaaaaaa-new-2");
    vi.advanceTimersByTime(3000);
    expect(openedByOtherMacJustNow("peer-aaaaaaaa-new-2")).toBe(false);
  });
});
