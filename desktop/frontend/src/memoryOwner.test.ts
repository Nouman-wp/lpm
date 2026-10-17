import { describe, expect, it } from "vitest";
import { memoryOwner } from "./memoryOwner";
import { prefixName, prefixRoot } from "./peer/markers";

describe("memoryOwner", () => {
  it("names this Mac's owner by its folder", () => {
    expect(memoryOwner("web-2", "/Users/me/.lpm/memory/web")).toBe("web");
    expect(memoryOwner("web", "")).toBe("");
  });

  it("names a paired machine's owner as this Mac lists it", () => {
    const slug = "abcdef12";
    expect(memoryOwner(prefixName(slug, "web"), prefixRoot(slug, "/Users/them/.lpm/memory/web"))).toBe(
      prefixName(slug, "web"),
    );
    expect(memoryOwner(prefixName(slug, "web-2"), prefixRoot(slug, "/Users/them/.lpm/memory/web"))).toBe(
      prefixName(slug, "web"),
    );
  });
});
