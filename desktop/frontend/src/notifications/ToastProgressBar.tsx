import type { ToastProgress } from "./types";

/** One segment per step, filled as each one finishes. */
export function ToastProgressBar({ progress: { step, steps } }: { progress: ToastProgress }) {
  return (
    <div className="toast-steps" role="progressbar" aria-valuemin={0} aria-valuemax={steps} aria-valuenow={step}>
      {Array.from({ length: steps }, (_, i) => (
        <span key={i} data-done={i < step || undefined} />
      ))}
    </div>
  );
}
