import { describe, expect, it } from "vitest";
import { newDiscussionUrl, newIssueUrl, sendToRequestUrl } from "./githubIssue";

const params = (url: string) => new URL(url).searchParams;

describe("githubIssue", () => {
  it("fills in a new issue on lpm's repo", () => {
    const url = newIssueUrl({ title: "It's (broken)!", body: "a & b", labels: ["bug"] });
    expect(url.startsWith("https://github.com/gug007/lpm/issues/new?")).toBe(true);
    expect(url).not.toMatch(/[!'()]/);
    expect(params(url).get("title")).toBe("It's (broken)!");
    expect(params(url).get("body")).toBe("a & b");
    expect(params(url).get("labels")).toBe("bug");
    expect(params(newIssueUrl({ title: "t", body: "b" })).has("labels")).toBe(false);
  });

  it("fills in a new discussion in the given category", () => {
    const url = newDiscussionUrl({ title: "How (do) I?", body: "a & b", category: "q-a" });
    expect(url.startsWith("https://github.com/gug007/lpm/discussions/new?")).toBe(true);
    expect(url).not.toMatch(/[!'()]/);
    expect(params(url).get("category")).toBe("q-a");
    expect(params(url).get("title")).toBe("How (do) I?");
    expect(params(url).get("body")).toBe("a & b");
  });

  it("asks for another place to send results, saying what's there already", () => {
    const p = params(sendToRequestUrl());
    expect(p.get("title")).toBe("Send to: ");
    expect(p.get("labels")).toBe("enhancement");
    expect(p.get("body")).toContain("Where should automations be able to send their results?");
    expect(p.get("body")).toContain("Already supported: lpm, Telegram");
  });
});
