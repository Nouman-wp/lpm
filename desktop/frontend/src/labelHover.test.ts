import { describe, expect, it, vi } from "vitest";
import type { ActionInfo } from "./types";

const refresh = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../bridge/commands", () => ({ RefreshActionLabel: refresh }));

import { refreshLabelOnHover } from "./labelHover";

const action = (name: string, labelRefreshOnHover?: boolean) =>
  ({ name, label: name, cmd: "x", confirm: false, display: "", labelRefreshOnHover }) as ActionInfo;

describe("refreshLabelOnHover", () => {
  it("asks only for buttons that opt in", () => {
    expect(refreshLabelOnHover("app", action("build"), 0)).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks once per gap for each project's button", () => {
    expect(refreshLabelOnHover("app", action("release", true), 1_000)).toBe(true);
    expect(refreshLabelOnHover("app", action("release", true), 3_000)).toBe(false);
    expect(refreshLabelOnHover("web", action("release", true), 3_000)).toBe(true);
    expect(refreshLabelOnHover("app", action("release", true), 6_000)).toBe(true);
    expect(refresh.mock.calls).toEqual([
      ["app", "release"],
      ["web", "release"],
      ["app", "release"],
    ]);
  });
});
