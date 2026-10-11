// A plain-language "when" turned into a cron line by the user's default agent,
// and its reply read back through the same parser the editor checks with.

import { parseCron } from "./cronExpr";

export const CRON_INSTRUCTION = `Turn the description below into one standard five-field cron line: minute, hour, day of month, month, day of week, read in local time. Use lists, ranges, steps and three-letter names where they help. No seconds or year field, no @ shorthands, and keep runs at least 5 minutes apart.

If a single cron line can't say it, reply with NONE: followed by a short reason instead.

Reply with the cron line alone.`;

export type CronReply = { cron: string } | { error: string };

function sentence(text: string): string {
  const s = text.trim().replace(/^./, (c) => c.toUpperCase());
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

export function readCronReply(raw: string): CronReply {
  const line =
    raw
      .replace(/```[a-z]*/gi, "")
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const text = line.replace(/^`+|`+$/g, "").trim();
  if (!text) return { error: "The agent didn't reply with a cron line." };
  const none = /^none\b:?\s*(.*)$/i.exec(text);
  if (none) {
    return { error: none[1] ? sentence(none[1]) : "One cron line can't say that." };
  }
  const parsed = parseCron(text);
  return parsed.ok
    ? { cron: parsed.spec.source }
    : { error: `The agent replied “${text}”. ${parsed.error}` };
}
