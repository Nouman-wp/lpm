import { describe, expect, it } from "vitest";
import { addToChannelUrl, addToGroupUrl, findBotToken, startUrl } from "./telegramLinks";

const TOKEN = "123456789:AAFakeTokenForTestsOnly_abc-DEF123456";

describe("telegramLinks", () => {
  it("finds the token in BotFather's whole reply", () => {
    expect(findBotToken(TOKEN)).toBe(TOKEN);
    expect(findBotToken(`Done! Use this token to access the HTTP API:\n${TOKEN}\nKeep it secure`)).toBe(TOKEN);
    expect(findBotToken("t.me/lpm_bot")).toBeNull();
  });

  it("builds the links that open Telegram on the right screen", () => {
    expect(startUrl("lpm_bot", "c0de")).toBe("https://t.me/lpm_bot?start=c0de");
    expect(addToGroupUrl("lpm_bot", "c0de")).toBe("https://t.me/lpm_bot?startgroup=c0de");
    expect(addToChannelUrl("lpm_bot")).toBe("https://t.me/lpm_bot?startchannel&admin=post_messages");
  });
});
