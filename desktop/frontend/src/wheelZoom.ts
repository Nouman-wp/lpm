// How long the wheel must rest before the next event starts a new gesture. A
// swipe, and the momentum a trackpad keeps sending after the fingers lift,
// arrive about a frame apart.
export const WHEEL_GESTURE_GAP_MS = 150;

// Whether a wheel event is a zoom (⌘-scroll, Ctrl-scroll, or a trackpad pinch,
// which arrives as Ctrl+wheel) rather than a scroll. Decided once per gesture,
// by the modifiers held as it began: a modifier pressed while a scroll is still
// coasting would otherwise turn the rest of the coast into a zoom. One gate per
// surface, kept for as long as the surface listens.
export function createWheelZoomGate(now: () => number = () => performance.now()) {
  let lastAt = -Infinity;
  let zooming = false;
  return (e: Pick<WheelEvent, "ctrlKey" | "metaKey">): boolean => {
    const modified = e.ctrlKey || e.metaKey;
    const at = now();
    if (at - lastAt > WHEEL_GESTURE_GAP_MS) zooming = modified;
    lastAt = at;
    return zooming && modified;
  };
}
