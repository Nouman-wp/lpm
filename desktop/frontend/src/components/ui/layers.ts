// Escape belongs to whatever is on top: an open menu (it closes itself), else
// the newest blocking dialog. Whether something like that covers `el`.
export function coveredByLayer(el: Element | null): boolean {
  if (document.querySelector("[data-context-menu]")) return true;
  const own = el?.closest("[data-modal-overlay]");
  if (!own) return false;
  const dialogs = document.querySelectorAll('[data-modal-overlay] > [aria-modal="true"]');
  const top = dialogs[dialogs.length - 1]?.parentElement;
  return !!top && top !== own;
}
