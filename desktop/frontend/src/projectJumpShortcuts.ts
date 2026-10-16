import type { KeyboardShortcut } from "./hooks/useKeyboardShortcut";

// Jumping to a project focuses its composer, so ⌘1–⌘9 stay live inside text
// scopes; otherwise every jump after the first would be swallowed.
export const PROJECT_JUMP_SHORTCUTS: KeyboardShortcut[] = Array.from({ length: 9 }, (_, i) => ({
  key: String(i + 1),
  meta: true,
}));
