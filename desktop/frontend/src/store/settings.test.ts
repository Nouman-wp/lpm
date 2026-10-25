import { describe, expect, it } from "vitest";
import { settingsFromFile } from "./settings";

describe("settingsFromFile", () => {
  it("keeps the per-event notification choices and the typing hold", () => {
    const channels = { agentDone: { inApp: true, banner: false } };
    expect(settingsFromFile({ notificationChannels: channels, holdToastsWhileTyping: false })).toMatchObject({
      notificationChannels: channels,
      holdToastsWhileTyping: false,
    });
  });

  it("holds toasts while typing unless told not to", () => {
    expect(settingsFromFile({}).holdToastsWhileTyping).toBe(true);
  });
});
