import { describe, expect, it } from "vitest";
import { readCronReply } from "./cronAI";

describe("readCronReply", () => {
  it("takes the line alone, whatever came with it", () => {
    expect(readCronReply("30 9 * * 1-5")).toEqual({ cron: "30 9 * * 1-5" });
    expect(readCronReply("```\n`0  18 * * fri`\n```")).toEqual({ cron: "0 18 * * fri" });
  });

  it("passes on why one line can't say it", () => {
    expect(readCronReply("NONE: cron has no last day of the month")).toEqual({
      error: "Cron has no last day of the month.",
    });
    expect(readCronReply("none")).toEqual({ error: "One cron line can't say that." });
  });

  it("refuses a reply the scheduler wouldn't take", () => {
    expect(readCronReply("* * * * *")).toEqual({
      error: "The agent replied “* * * * *”. An automation can run at most every 5 minutes.",
    });
    expect(readCronReply("")).toEqual({ error: "The agent didn't reply with a cron line." });
  });
});
