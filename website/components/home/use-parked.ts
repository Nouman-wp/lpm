"use client";

import { useEffect, useState, type RefObject } from "react";

// Parked is most of the frame on screen: what the tour waits for, so nobody
// spends the whole performance on it below the fold. It holds until the frame
// is mostly gone again.
export function useParked(ref: RefObject<HTMLElement | null>) {
  const [parked, setParked] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          // A hair under the threshold: the ratio a crossing reports is the
          // threshold itself, and floating point does not always agree.
          setParked(ratio >= 0.8);
        }
      },
      { threshold: [0.4, 0.85] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return parked;
}
