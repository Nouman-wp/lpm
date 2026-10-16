import { describe, expect, it } from "vitest";
import { backgroundRunDuration, failureText, formatElapsed } from "./backgroundRunToastText";

describe("backgroundRunDuration", () => {
  it("keeps a running or pinned toast up", () => {
    expect(backgroundRunDuration("running", false)).toBe(Infinity);
    expect(backgroundRunDuration("error", true)).toBe(Infinity);
  });

  it("lets a failure auto-dismiss, later than a success", () => {
    const failed = backgroundRunDuration("error", false);
    expect(Number.isFinite(failed)).toBe(true);
    expect(failed).toBeGreaterThan(backgroundRunDuration("success", false));
    expect(Number.isFinite(backgroundRunDuration("cancelled", false))).toBe(true);
  });
});

describe("formatElapsed", () => {
  it("formats seconds and minutes", () => {
    expect(formatElapsed(900)).toBe("0s");
    expect(formatElapsed(69_000)).toBe("1m 9s");
    expect(formatElapsed(-5)).toBe("0s");
  });
});

describe("failureText", () => {
  it("shows the whole failure while the output is hidden", () => {
    expect(failureText("exit status 2: about to fail", false)).toBe(
      "exit status 2: about to fail",
    );
  });

  it("drops the output tail once the output is shown", () => {
    expect(failureText("exit status 2: about to fail", true)).toBe("exit status 2");
    expect(failureText("signal: 9: killed", true)).toBe("signal: 9");
  });

  it("keeps a failure that carries no output tail", () => {
    expect(failureText("exit status 1", true)).toBe("exit status 1");
    expect(failureText("project not found", true)).toBe("project not found");
  });
});
