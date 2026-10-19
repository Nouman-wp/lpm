import { describe, expect, it } from "vitest";
import type { UsageMachine } from "../../types";
import { machineStatus, machinesNoun, statsSubtitle } from "./statsMachines";

const local: UsageMachine = {
  id: "local",
  name: "Studio",
  platform: "macos",
  headless: false,
  local: true,
  connected: true,
};
const laptop: UsageMachine = {
  id: "aaaaaaaa",
  name: "MacBook Pro 2021",
  platform: "macos",
  local: false,
  connected: true,
};
const server: UsageMachine = {
  id: "bbbbbbbb",
  name: "85.9.204.194",
  platform: "linux",
  headless: true,
  local: false,
  connected: true,
};

describe("statsSubtitle", () => {
  it("keeps the local copy with nothing paired", () => {
    expect(statsSubtitle("all", [local])).toBe("Local token usage across your lpm projects");
  });

  it("keeps the local copy when this computer is picked", () => {
    expect(statsSubtitle("local", [local, laptop])).toBe(
      "Local token usage across your lpm projects",
    );
  });

  it("names a paired computer that is picked", () => {
    expect(statsSubtitle("aaaaaaaa", [local, laptop])).toBe("Token usage on MacBook Pro 2021");
  });

  it("counts every computer when all answered", () => {
    expect(statsSubtitle("all", [local, laptop])).toBe("Token usage across your 2 Macs");
    expect(statsSubtitle("all", [local, laptop, server])).toBe(
      "Token usage across your 3 computers",
    );
  });

  it("says which share of them is in the total", () => {
    const offline = { ...laptop, connected: false };
    const failed = { ...server, error: "timed out" };
    expect(statsSubtitle("all", [local, offline, failed])).toBe(
      "Token usage across 1 of your 3 computers",
    );
  });
});

describe("machinesNoun", () => {
  it("calls them Macs only when every one is", () => {
    expect(machinesNoun([local, laptop]).many).toBe("Macs");
    expect(machinesNoun([local, server]).one).toBe("computer");
  });
});

describe("machineStatus", () => {
  it("shows this computer's own name, and how a paired one is doing", () => {
    expect(machineStatus(local)).toBe("Studio");
    expect(machineStatus(laptop)).toBe("Online");
    expect(machineStatus({ ...laptop, connected: false })).toBe("Offline");
    expect(machineStatus({ ...server, error: "timed out" })).toBe("Couldn't read its stats");
  });
});
