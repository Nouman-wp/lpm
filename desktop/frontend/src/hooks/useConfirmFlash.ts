import { useCallback, useEffect, useRef, useState } from "react";

const CONFIRM_MS = 1500;

/** Which of several controls answers in place ("✓ Copied") right now: the key
 *  last flashed, for a moment after its control is used. */
export function useConfirmFlashFor<K>(): [K | null, (key: K) => void] {
  const [flashed, setFlashed] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback((key: K) => {
    clearTimeout(timer.current);
    setFlashed(() => key);
    timer.current = setTimeout(() => setFlashed(null), CONFIRM_MS);
  }, []);

  return [flashed, flash];
}

/** A control that answers in place ("✓ Copied") for a moment after it's used,
 *  instead of a toast in the far corner. */
export function useConfirmFlash(): [boolean, () => void] {
  const [flashed, flash] = useConfirmFlashFor<true>();
  return [flashed !== null, useCallback(() => flash(true), [flash])];
}
