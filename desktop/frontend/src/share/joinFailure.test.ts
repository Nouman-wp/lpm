import { describe, expect, it } from "vitest";
import { joinFailure } from "./joinFailure";

describe("join failures", () => {
  it("names the computer that can't be reached and keeps the cause", () => {
    const f = joinFailure(
      "Couldn't reach the machine that shared this tab: Connection refused (os error 61)",
      "Maya's MacBook Pro",
    );
    expect(f.title).toBe("Can't reach Maya's MacBook Pro");
    expect(f.retry).toBe("Try again");
    expect(f.detail).toBe("Connection refused (os error 61)");
  });

  it("offers to ask again after a no or no answer", () => {
    expect(joinFailure("The host didn't let you in.", "Maya's MacBook Pro")).toMatchObject({
      title: "Maya's MacBook Pro didn't let you in",
      retry: "Ask again",
    });
    expect(joinFailure("The host didn't answer in time.", "").retry).toBe("Ask again");
  });

  it("has nothing to retry once the link has ended", () => {
    expect(joinFailure("This invite has ended. Ask for a new one.", "").retry).toBeNull();
  });

  it("shows anything else as it came", () => {
    expect(joinFailure("boom", "")).toMatchObject({ title: "Couldn't join", text: "boom" });
  });
});
