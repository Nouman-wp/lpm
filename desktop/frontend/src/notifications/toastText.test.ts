import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { plainText, splitErrorMessage } from "./toastText";

describe("splitErrorMessage", () => {
  it("leads with the label and keeps a short reason as the description", () => {
    expect(splitErrorMessage("Pull failed: Not possible to fast-forward, aborting.")).toEqual({
      title: "Pull failed",
      description: "Not possible to fast-forward, aborting.",
    });
  });

  it("moves long raw output under details", () => {
    const raw = `fatal: unable to access 'https://github.com/acme/web.git/': ${"x".repeat(200)}`;
    expect(splitErrorMessage(`Couldn't fetch: ${raw}`)).toEqual({ title: "Couldn't fetch", details: raw });
  });

  it("leads with the first line of multi-line output and keeps all of it, unlabelled, as details", () => {
    expect(splitErrorMessage("Couldn't push: rejected\nhint: Updates were rejected")).toEqual({
      title: "Couldn't push",
      description: "rejected",
      details: "rejected\nhint: Updates were rejected",
    });
  });

  it("doesn't split on a colon that isn't a label", () => {
    expect(splitErrorMessage("Couldn't open :5432")).toEqual({ title: "Couldn't open :5432" });
    expect(splitErrorMessage("See https://lpm.cx/help")).toEqual({ title: "See https://lpm.cx/help" });
  });

  it("clips an unlabelled long message to its first sentence", () => {
    const text = `The relay refused the share. ${"More words. ".repeat(20)}`;
    expect(splitErrorMessage(text)).toEqual({ title: "The relay refused the share.", details: text.trim() });
  });
});

describe("plainText", () => {
  it("reads strings, numbers and the text inside elements", () => {
    expect(plainText("a")).toBe("a");
    expect(plainText(3)).toBe("3");
    expect(plainText(createElement("b", null, "bold ", createElement("i", null, "words")))).toBe("bold words");
    expect(plainText(null)).toBe("");
  });
});
