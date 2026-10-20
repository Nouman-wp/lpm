import { useEventListener } from "./useEventListener";

// Escape closes an open menu or popover, captured so it closes before whatever
// it sits in (a modal, the + popup) hears the key.
export function useDismissOnEscape(open: boolean, onDismiss: () => void) {
  useEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    },
    document,
    open,
    true,
  );
}
