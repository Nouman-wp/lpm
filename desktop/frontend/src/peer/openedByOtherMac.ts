// A tab that opens here because the other Mac opened its terminal — a host's new
// terminal showing up on the paired Mac, or a paired Mac's start showing up on
// the host — says nothing about which Mac is in use. For a moment after it
// opens, this Mac doesn't claim it: showing it presents instead, and the window
// focus its own auto-focus can raise is ignored, so control stays with the Mac
// that opened it. A time window rather than a one-shot flag: React runs mount
// effects twice in development, and a tab first shown later is shown on purpose.
const GRACE_MS = 3000;

const openedAt = new Map<string, number>();

export function noteOpenedByOtherMac(id: string): void {
  openedAt.set(id, Date.now());
}

export function openedByOtherMacJustNow(id: string): boolean {
  const at = openedAt.get(id);
  if (at === undefined) return false;
  if (Date.now() - at < GRACE_MS) return true;
  openedAt.delete(id);
  return false;
}
