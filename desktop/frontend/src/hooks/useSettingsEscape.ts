import { useOverlayStore } from "../store/overlay";
import { TEXT_SCOPE_SELECTOR } from "../shortcutScope";
import { useEventListener } from "./useEventListener";

const FIELDS = `input, textarea, select, [contenteditable='true'], ${TEXT_SCOPE_SELECTOR}`;

// Escape leaves Settings unless something in it takes the key first: a dialog,
// a menu, or a field being typed in. The search box is the exception once it's
// empty, since Escape there has nothing left to clear.
export function useSettingsEscape(onLeave: () => void): void {
  useEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (useOverlayStore.getState().count > 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest(FIELDS) && !target.closest("[data-settings-search]")) {
      return;
    }
    onLeave();
  });
}
