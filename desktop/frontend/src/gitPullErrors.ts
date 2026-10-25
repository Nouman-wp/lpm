import { toast } from "./notifications/toast";
import type { ToastId } from "./notifications/types";

// The backend ends the message for a pull blocked by uncommitted changes that
// autostash would carry over with this phrase (gitconflict.rs).
const AUTOSTASH_HINT = "pull with autostash";

export function offersAutostash(err: unknown): boolean {
  return String(err).includes(AUTOSTASH_HINT);
}

// A pull that went through but left conflicts says so itself ("Pulled, but…"),
// so it doesn't get the "failed" prefix.
export function pullErrorText(err: unknown, label: string, project?: string): string {
  const text = String(err);
  if (!text.startsWith("Pulled")) return `${label}: ${text}`;
  return project ? `${project}: ${text}` : text;
}

interface PullErrorToast {
  label: string;
  id?: ToastId;
  retry: () => void;
  retryWithAutostash: () => void;
}

// A pull that local changes blocked is retried with autostash, since pulling
// again as it was would only fail the same way.
export function toastPullError(err: unknown, { label, id, retry, retryWithAutostash }: PullErrorToast): void {
  const autostash = offersAutostash(err);
  toast.error(pullErrorText(err, label), {
    id,
    retry: autostash ? undefined : retry,
    action: autostash ? { label: "Pull with autostash", onClick: retryWithAutostash } : undefined,
  });
}
