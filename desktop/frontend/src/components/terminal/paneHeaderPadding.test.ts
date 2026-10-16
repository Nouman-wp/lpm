import { describe, expect, it } from "vitest";
import { paneHeaderPadding } from "./paneHeaderPadding";

describe("paneHeaderPadding", () => {
  it("clears the traffic lights for a fullscreen pane on macOS", () => {
    expect(paneHeaderPadding(true, true, false)).toBe("pl-20 pr-2");
  });

  it("keeps the plain padding when the traffic lights aren't there", () => {
    expect(paneHeaderPadding(false, true, false)).toBe("px-2");
    expect(paneHeaderPadding(true, false, false)).toBe("px-2");
    expect(paneHeaderPadding(true, true, true)).toBe("px-2");
  });
});
