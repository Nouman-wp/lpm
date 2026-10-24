import { chordLabel, matchesChord, type Chord } from "../keys";
import { isMac } from "../platform";
import { enterHint } from "../shortcutHints";

export type BranchKeyAction = "rename" | "delete" | "copy";

// ⌘R / ⌘⌫ / ⌘C on macOS; elsewhere Ctrl+Shift, so Ctrl+Backspace still
// deletes a word in the search box.
function chords(mac: boolean): Record<BranchKeyAction, Chord> {
  return {
    rename: { key: "r", meta: true },
    delete: mac ? { key: "Backspace", meta: true } : { key: "Backspace", meta: true, shift: true },
    copy: { key: "c", meta: true },
  };
}

const ORDER: BranchKeyAction[] = ["rename", "delete", "copy"];

export function branchKeyAction(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
  mac: boolean = isMac,
): BranchKeyAction | null {
  const map = chords(mac);
  return ORDER.find((a) => matchesChord(e, map[a], mac)) ?? null;
}

export function branchKeyLabel(action: BranchKeyAction, mac: boolean = isMac): string {
  return chordLabel(chords(mac)[action], mac);
}

export function branchKeyHints(mac: boolean = isMac): { keys: string; label: string }[] {
  return [
    { keys: enterHint({}, "↵", mac), label: "switch" },
    { keys: branchKeyLabel("rename", mac), label: "rename" },
    { keys: branchKeyLabel("delete", mac), label: "delete" },
    { keys: branchKeyLabel("copy", mac), label: "copy name" },
  ];
}
