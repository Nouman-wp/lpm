import { describe, expect, it } from "vitest";
import { middleTruncate } from "./middleTruncate";

describe("middleTruncate", () => {
  it("keeps a name that fits", () => {
    expect(middleTruncate("feat/billing-flow", 19)).toBe("feat/billing-flow");
  });

  it("keeps both ends of a long name", () => {
    const out = middleTruncate("exp/data-pipeline-v3", 19);
    expect([...out]).toHaveLength(19);
    expect(out.startsWith("exp/data")).toBe(true);
    expect(out.endsWith("eline-v3")).toBe(true);
    expect(out).toContain("…");
  });
});
