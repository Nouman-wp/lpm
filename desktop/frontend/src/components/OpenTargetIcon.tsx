import { DEFAULT_APP_ID } from "../hooks/useOpenFileTargets";
import type { OpenInTarget } from "../hooks/useOpenInTargets";

export function OpenTargetIcon({ target }: { target: OpenInTarget }) {
  if (target.id === DEFAULT_APP_ID) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-[var(--text-secondary)]"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    );
  }
  return <img src={target.icon} alt="" className="h-4 w-4 shrink-0" />;
}
