const pad2 = (n: number) => String(n).padStart(2, "0");

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// The next run as the automations list shows it, beside the on/off switch:
// "Tomorrow 09:00", "Friday 17:00", "Oct 30 09:00".
export function nextRunLabel(nextFireAt: number | undefined, now: Date = new Date()): string {
  if (!nextFireAt) return "";
  const at = new Date(nextFireAt * 1000);
  if (at.getTime() <= now.getTime()) return "In a moment";
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(at, now)) return `Today ${time}`;
  if (sameDay(at, tomorrow)) return `Tomorrow ${time}`;
  const days = Math.round((at.getTime() - now.getTime()) / 86400000);
  const day =
    days < 7
      ? at.toLocaleDateString(undefined, { weekday: "long" })
      : at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} ${time}`;
}
