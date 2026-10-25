import { getSettings } from "../store/settings";

// Toasts that arrive mid-sentence wait until the composer goes quiet, so they
// don't pop up over what's being typed.
const IDLE_MS = 1500;
const COMPOSER = "[data-terminal-composer]";

let onRelease: (() => void) | null = null;
let lastKeyAt = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

const inComposer = (target: EventTarget | null) => target instanceof Element && target.closest(COMPOSER) !== null;

function release() {
  clearTimeout(releaseTimer);
  if (lastKeyAt === 0) return;
  lastKeyAt = 0;
  onRelease?.();
}

function wire() {
  if (onRelease || typeof window === "undefined") return;
  window.addEventListener(
    "keydown",
    (e) => {
      if (!inComposer(e.target)) return;
      lastKeyAt = Date.now();
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(release, IDLE_MS);
    },
    { capture: true, passive: true },
  );
  window.addEventListener("focusout", (e) => inComposer(e.target) && release(), { capture: true });
}

export function holdsToasts(): boolean {
  return getSettings().holdToastsWhileTyping === true && Date.now() - lastKeyAt < IDLE_MS;
}

/** Sets what runs when held toasts may show: the composer went quiet or lost focus. */
export function whenToastsReleased(callback: () => void): void {
  wire();
  onRelease = callback;
}
