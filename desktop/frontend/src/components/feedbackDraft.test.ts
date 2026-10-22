import { describe, expect, it } from "vitest";
import { feedbackTitle, guessFeedbackKind } from "./feedbackDraft";

describe("guessFeedbackKind", () => {
  it("has no guess for blank text", () => {
    expect(guessFeedbackKind("")).toBeNull();
    expect(guessFeedbackKind("   \n ")).toBeNull();
  });

  it.each([
    "The terminal crashes when I paste a long line",
    "Split panes don't work after I rename a tab. Doesn’t open at all",
    "Services won't start after switching branches",
    "Clicked Build and nothing happens",
  ])("reads %j as a bug", (text) => {
    expect(guessFeedbackKind(text)).toBe("bug");
  });

  it.each([
    "It would be nice to pin projects to the top of the sidebar",
    "Add a dark theme for the diff view",
    "Could you support Windows on ARM?",
    "The branch picker takes about 5 seconds to open in our monorepo (2,400 branches). Could it show the branches I used this week first and load the rest after?",
  ])("reads %j as an idea", (text) => {
    expect(guessFeedbackKind(text)).toBe("suggestion");
  });

  it.each([
    "How do I run two agents on the same project at once?",
    "Is there an option to hide the usage bars?",
    "Where are automation logs stored?",
  ])("reads %j as a question", (text) => {
    expect(guessFeedbackKind(text)).toBe("question");
  });

  it("calls text with no signal an idea", () => {
    expect(guessFeedbackKind("Dark mode looks great")).toBe("suggestion");
  });

  it("lets a bug win a tie with a request to fix it", () => {
    expect(guessFeedbackKind("The app crashes on start. Could you look at it?")).toBe("bug");
  });
});

describe("feedbackTitle", () => {
  it("takes the first sentence without its period", () => {
    expect(feedbackTitle("Pin projects to the top. I switch between twelve.")).toBe(
      "Pin projects to the top",
    );
  });

  it("keeps a question mark", () => {
    expect(feedbackTitle("How do I run two agents? I tried duplicates.")).toBe(
      "How do I run two agents?",
    );
  });

  it("stops at the first line", () => {
    expect(feedbackTitle("  Build runs twice\n\nSteps: click Build twice")).toBe("Build runs twice");
  });

  it("doesn't split a version number", () => {
    expect(feedbackTitle("0.7.32 broke the footer. It was fine before")).toBe("0.7.32 broke the footer");
  });

  it("cuts a long sentence at a word", () => {
    const title = feedbackTitle(
      "When I open the branch picker in a repository with thousands of branches it takes several seconds every single time",
    );
    expect(title).toBe("When I open the branch picker in a repository with thousands of branches it…");
    expect(title.length).toBeLessThanOrEqual(81);
  });
});
