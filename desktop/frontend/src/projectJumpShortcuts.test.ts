// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { PROJECT_JUMP_SHORTCUTS } from "./projectJumpShortcuts";
import { firesForTarget } from "./shortcutScope";
import { matchesShortcut } from "./hooks/useKeyboardShortcut";

describe("PROJECT_JUMP_SHORTCUTS", () => {
  it("covers ⌘1 through ⌘9", () => {
    expect(PROJECT_JUMP_SHORTCUTS.map((s) => s.key)).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    );
    const press = {
      key: "4",
      code: "Digit4",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(PROJECT_JUMP_SHORTCUTS.filter((s) => matchesShortcut(press, s, true))).toHaveLength(1);
  });

  it("fires from the composer a previous jump focused", () => {
    const composer = document.createElement("div");
    composer.setAttribute("data-text-scope", "");
    for (const s of PROJECT_JUMP_SHORTCUTS) expect(firesForTarget(s, composer)).toBe(true);
  });
});
