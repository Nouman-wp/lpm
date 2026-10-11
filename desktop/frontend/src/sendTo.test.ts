import { describe, expect, it } from "vitest";
import {
  normalizeSendTo,
  readSendTo,
  sendToName,
  sendToReady,
  sendToSummary,
  splitSendTo,
  writeSendTo,
  type SendToLinks,
} from "./sendTo";

const links: SendToLinks = {
  telegram: {
    connected: true,
    targets: [
      { key: "ada", name: "Ada", kind: "private" },
      { key: "releases", name: "Releases", kind: "channel" },
    ],
  },
};

describe("sendTo", () => {
  it("reads one place, a list, or nothing as lpm alone", () => {
    expect(readSendTo(undefined)).toEqual(["lpm"]);
    expect(readSendTo("Telegram:Releases")).toEqual(["telegram:releases"]);
    expect(readSendTo(["lpm", "telegram", "lpm"])).toEqual(["lpm", "telegram"]);
    expect(readSendTo([])).toEqual(["lpm"]);
  });

  it("writes nothing for the default and keeps the menu's order", () => {
    expect(writeSendTo(["lpm"])).toBeUndefined();
    expect(writeSendTo(["telegram:releases", "lpm"])).toEqual(["lpm", "telegram:releases"]);
    expect(writeSendTo(["slack:ops", "telegram"])).toEqual(["telegram", "slack:ops"]);
  });

  it("splits a service from its target", () => {
    expect(splitSendTo("telegram:releases")).toEqual({ service: "telegram", key: "releases" });
    expect(splitSendTo("lpm")).toEqual({ service: "lpm" });
  });

  it("reads plain telegram as the first chat, once", () => {
    expect(normalizeSendTo(["lpm", "telegram"], links)).toEqual(["lpm", "telegram:ada"]);
    expect(normalizeSendTo(["telegram", "telegram:ada"], links)).toEqual(["telegram:ada"]);
    expect(normalizeSendTo(["telegram"], { telegram: undefined })).toEqual(["telegram"]);
  });

  it("knows which places can take a message", () => {
    expect(sendToReady("lpm", {})).toBe(true);
    expect(sendToReady("telegram:releases", links)).toBe(true);
    expect(sendToReady("telegram:gone", links)).toBe(false);
    expect(sendToReady("telegram", { telegram: { connected: false, targets: [] } })).toBe(false);
    expect(sendToReady("telegram", {})).toBeUndefined();
  });

  it("names and sums the places up", () => {
    expect(sendToName("telegram", links)).toBe("Ada");
    expect(sendToName("telegram:releases", links)).toBe("Releases");
    expect(sendToName("telegram", {})).toBe("Telegram");
    expect(sendToSummary(["telegram:releases", "lpm"], links)).toBe("lpm + Releases");
    expect(sendToSummary(["lpm", "telegram:ada", "telegram:releases"], links)).toBe("lpm + 2 more");
    expect(sendToSummary([], links)).toBe("Nowhere");
  });
});
