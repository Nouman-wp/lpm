import { toast } from "sonner";

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

export function toastPullError(
  err: unknown,
  label: string,
  retryWithAutostash: () => void,
  id?: string | number,
): void {
  const autostash = offersAutostash(err);
  toast.error(pullErrorText(err, label), {
    id,
    duration: autostash ? 12000 : undefined,
    action: autostash ? { label: "Pull with autostash", onClick: retryWithAutostash } : undefined,
  });
}
