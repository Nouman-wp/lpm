export const TOAST_EDGE = 12;
const TOAST_WIDTH = 356;

// Close-with-undo toasts keep to the footer row's left end, clear of every
// pane's composer and its Send button.
export const FOOTER_TOASTER_ID = "footer";
export const FOOTER_TOASTER_OFFSET = { bottom: 4, left: 12 };

/** Toasts stack up from the bottom right, just above whatever the window keeps
 *  under them there — the footer row and, in a pane that has one, the composer
 *  — so a toast never covers Send or the Git buttons that raised it. Elements
 *  that count are marked `data-toast-floor`. */
export function toastFloor(
  right: number,
  root: ParentNode = document,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): number {
  const left = viewport.width - right - TOAST_WIDTH;
  let top = viewport.height;
  for (const el of root.querySelectorAll<HTMLElement>("[data-toast-floor]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= left || r.left >= viewport.width - right) continue;
    top = Math.min(top, r.top);
  }
  return Math.round(viewport.height - top) + TOAST_EDGE;
}
