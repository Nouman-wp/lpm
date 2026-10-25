import { useLayoutEffect, useState } from "react";
import { useSonner } from "sonner";
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
  const pile = useSonner().toasts.filter((t) => t.toasterId === undefined);
  const count = pile.length;
  const frontId = pile[0]?.id;
  const [frontHeight, setFrontHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // sonner lays a new toast out in the same tick it reports it here, so the
  // front card is already in place. Its height and whether the pile is fanned
  // out (hover or its hotkey) are read off that card.
  useLayoutEffect(() => {
    if (count < 2) return;
    const front = document.querySelector<HTMLElement>(
      '[data-sonner-toaster][data-x-position="right"] [data-sonner-toast][data-front="true"]',
    );
    if (!front) return;
    const read = () => {
      setFrontHeight(front.getBoundingClientRect().height);
      setExpanded(front.dataset.expanded === "true");
    };
    const resized = new ResizeObserver(read);
    const fanned = new MutationObserver(read);
    resized.observe(front);
    fanned.observe(front, { attributes: true, attributeFilter: ["data-expanded"] });
    read();
    return () => {
      resized.disconnect();
      fanned.disconnect();
    };
  }, [count, frontId]);

  if (count < 2 || frontHeight === 0 || expanded) return null;

  const tucked = Math.min(count, VISIBLE_TOASTS) - 1;
  return (
    <div
      className="toast-stack-chip"
      style={{ right: offset.right, bottom: offset.bottom + frontHeight + tucked * STACK_GAP + CHIP_GAP }}
    >
      <span>{count - 1} more</span>
      <button type="button" className="toast-button h-[22px] rounded-full text-[12.5px]" onClick={dismissCards}>
        Clear all
      </button>
    </div>
  );
}
