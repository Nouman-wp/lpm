import { useLayoutEffect, useState } from "react";
import { useLiveToasts } from "./liveToasts";
import { dismissCards } from "./toast";

// sonner's spacing: up to three toasts show, each tucked one gap above the last.
const STACK_GAP = 14;
const VISIBLE_TOASTS = 3;
const CHIP_GAP = 8;

interface ToastStackChipProps {
  offset: { right: number; bottom: number };
}

/** "2 more · Clear all" over a pile of toasts, so older ones can go in one
 *  click instead of fanning the pile out over the chat. */
export function ToastStackChip({ offset }: ToastStackChipProps) {
  const count = useLiveToasts((s) => s.toasts.length);
  const [frontHeight, setFrontHeight] = useState(0);
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    if (count < 2) return;
    const toaster = document.querySelector<HTMLElement>('[data-sonner-toaster][data-x-position="right"]');
    const front = toaster?.querySelector<HTMLElement>('[data-sonner-toast][data-front="true"]');
    if (!toaster || !front) return;
    const measure = () => setFrontHeight(front.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(front);
    measure();
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    toaster.addEventListener("mouseenter", enter);
    toaster.addEventListener("mouseleave", leave);
    return () => {
      observer.disconnect();
      toaster.removeEventListener("mouseenter", enter);
      toaster.removeEventListener("mouseleave", leave);
    };
  }, [count]);

  if (count < 2 || frontHeight === 0 || hovered) return null;

  const tucked = Math.min(count, VISIBLE_TOASTS) - 1;
  return (
    <div
      className="toast-stack-chip"
      style={{ right: offset.right, bottom: offset.bottom + frontHeight + tucked * STACK_GAP + CHIP_GAP }}
    >
      <span>{count - 1} more</span>
      <button type="button" className="toast-button" onClick={dismissCards}>
        Clear all
      </button>
    </div>
  );
}
