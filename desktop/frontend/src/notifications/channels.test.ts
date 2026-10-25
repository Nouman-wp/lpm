import { describe, expect, it } from "vitest";
import type { Settings } from "../store/settings";
import { channelEnabled, offersChannel } from "./channels";

const settings = (patch: Partial<Settings> = {}): Settings => ({ theme: "dark", doubleClickToToggle: false, ...patch });

describe("channelEnabled", () => {
  it("follows each event's defaults", () => {
    expect(channelEnabled(settings(), "agentWaiting", "inApp")).toBe(true);
    expect(channelEnabled(settings(), "agentDone", "inApp")).toBe(false);
    expect(channelEnabled(settings(), "agentDone", "banner")).toBe(true);
    expect(channelEnabled(settings(), "automation", "banner")).toBe(true);
  });

  it("never uses a channel the event doesn't offer", () => {
    expect(offersChannel("autoPull", "sound")).toBe(false);
    expect(channelEnabled(settings({ notificationChannels: { autoPull: { sound: true } } }), "autoPull", "sound")).toBe(
      false,
    );
  });

  it("lets the old all-events switches turn a channel off until a cell is chosen", () => {
    const off = settings({ soundNotifications: false, systemNotifications: false });
    expect(channelEnabled(off, "agentWaiting", "sound")).toBe(false);
    expect(channelEnabled(off, "automation", "banner")).toBe(false);
    expect(channelEnabled(off, "agentWaiting", "inApp")).toBe(true);

    const chosen = { ...off, notificationChannels: { agentWaiting: { sound: true } } };
    expect(channelEnabled(chosen, "agentWaiting", "sound")).toBe(true);
  });

  it("shows notifications that aren't about an event in the app only", () => {
    expect(channelEnabled(settings(), undefined, "inApp")).toBe(true);
    expect(channelEnabled(settings(), undefined, "banner")).toBe(false);
  });
});
