import { describe, expect, it } from "vitest";
import {
  folderMoveAction,
  folderMoveError,
  folderMoveNotice,
  folderMoveTarget,
  isFolderMoveBlocked,
} from "./renameFolderText";

describe("folderMoveNotice", () => {
  it("is silent when nothing works in the folder", () => {
    expect(isFolderMoveBlocked({ running: false, terminals: 0 })).toBe(false);
    expect(folderMoveNotice({ running: false, terminals: 0 })).toBeNull();
  });

  it("names what closes before the move", () => {
    expect(folderMoveNotice({ running: true, terminals: 3 })).toBe(
      "Running with 3 terminals. They close before the folder moves.",
    );
    expect(folderMoveNotice({ running: true, terminals: 1 })).toBe(
      "Running with 1 terminal. It closes before the folder moves.",
    );
    expect(folderMoveNotice({ running: true, terminals: 0 })).toBe(
      "Running. It stops before the folder moves.",
    );
    expect(folderMoveNotice({ running: false, terminals: 2 })).toBe(
      "2 terminals open. They close before the folder moves.",
    );
  });
});

describe("folderMoveAction", () => {
  it("offers to stop, close, or both", () => {
    expect(folderMoveAction({ running: true, terminals: 2 })).toBe("Stop & close");
    expect(folderMoveAction({ running: true, terminals: 0 })).toBe("Stop");
    expect(folderMoveAction({ running: false, terminals: 1 })).toBe("Close terminal");
    expect(folderMoveAction({ running: false, terminals: 4 })).toBe("Close terminals");
  });
});

describe("folderMoveError", () => {
  it("leads with what failed", () => {
    expect(folderMoveError("~/code/storefront-v2 already exists.")).toBe(
      "Couldn't move the folder: ~/code/storefront-v2 already exists.",
    );
    expect(folderMoveError(new Error("permission denied"))).toBe(
      "Couldn't move the folder: permission denied",
    );
  });
});

describe("folderMoveTarget", () => {
  it("splits off the folder's new name", () => {
    expect(folderMoveTarget("~/code/storefront-v2", false)).toEqual({
      dir: "~/code/",
      name: "storefront-v2",
    });
    expect(folderMoveTarget("/srv/app/", false)).toEqual({ dir: "/srv/", name: "app" });
  });

  it("follows Windows separators", () => {
    expect(folderMoveTarget("C:\\code\\shop\\", true)).toEqual({ dir: "C:\\code\\", name: "shop" });
  });
});
