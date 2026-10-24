import { describe, expect, it } from "vitest";
import { signedInLine } from "./claudeLoginStatus";

describe("signedInLine", () => {
  it("names the account and its plan", () => {
    expect(signedInLine({ signedIn: true, email: "ada@example.com", planLabel: "Max 20x" })).toBe(
      "Signed in as ada@example.com · Max 20x",
    );
  });

  it("leaves out what isn't known", () => {
    expect(signedInLine({ signedIn: true, email: "ada@example.com", planLabel: "" })).toBe(
      "Signed in as ada@example.com",
    );
    expect(signedInLine({ signedIn: true, email: "", planLabel: "Pro" })).toBe("Signed in · Pro");
    expect(signedInLine({ signedIn: true, email: "", planLabel: "" })).toBe("Signed in");
  });
});
