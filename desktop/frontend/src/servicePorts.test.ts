import { describe, expect, it } from "vitest";
import { linkedPorts, movedFromPort } from "./servicePorts";

describe("linkedPorts", () => {
  it("links the ports the service listens on", () => {
    expect(linkedPorts([3001, 9229], 3000, true)).toEqual([3001, 9229]);
  });

  it("falls back to the configured port until one is seen", () => {
    expect(linkedPorts([], 3000, true)).toEqual([3000]);
    expect(linkedPorts([], 0, true)).toEqual([]);
  });

  it("links nothing unseen where a fallback can't be reached", () => {
    expect(linkedPorts([], 3000, false)).toEqual([]);
  });
});

describe("movedFromPort", () => {
  it("names the configured port when the service listens elsewhere", () => {
    expect(movedFromPort([3001], 3000)).toBe(3000);
  });

  it("stays quiet while it listens on the configured port, or before it binds", () => {
    expect(movedFromPort([3000, 9229], 3000)).toBeUndefined();
    expect(movedFromPort([], 3000)).toBeUndefined();
    expect(movedFromPort([3001], 0)).toBeUndefined();
  });
});
