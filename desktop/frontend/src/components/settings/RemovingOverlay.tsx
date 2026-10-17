import { isMac } from "../../platform";
import { Spinner } from "./Spinner";

export function RemovingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-6 py-5 shadow-lg">
        <Spinner size={24} />
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {isMac ? "Removing lpm..." : "Removing lpm's tools..."}
        </p>
        {isMac && <p className="text-xs text-[var(--text-muted)]">The app will close when finished</p>}
      </div>
    </div>
  );
}
