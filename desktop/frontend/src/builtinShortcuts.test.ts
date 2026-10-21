import { describe, expect, it } from "vitest";
import { BUILTIN_SHORTCUT_GROUPS, builtinShortcutGroups } from "./builtinShortcuts";
import { buildSearchEntries } from "./settings-registry";

describe("built-in shortcuts", () => {
  it("gives every shortcut its own id and a key label", () => {
    const all = BUILTIN_SHORTCUT_GROUPS.flatMap((g) => g.shortcuts);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(all.every((s) => s.keys.trim() !== "" && s.label !== "")).toBe(true);
  });

  it("lists read-aloud keys only with the voice turned on", () => {
    expect(builtinShortcutGroups(false).some((g) => g.tts)).toBe(false);
    expect(builtinShortcutGroups(true).some((g) => g.tts)).toBe(true);
  });

  it("can be found from the settings search", () => {
    const ids = buildSearchEntries({ experimentalTTS: false, mac: true }).map((e) => e.id);
    expect(ids).toContain("shortcut.builtin.new-tab");
    expect(ids).not.toContain("shortcut.builtin.read");
  });
});
