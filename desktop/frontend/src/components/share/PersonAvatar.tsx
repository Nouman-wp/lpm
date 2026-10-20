const TINTS = [
  ["#4c1d95", "#e9d5ff"],
  ["#1e3a8a", "#bfdbfe"],
  ["#134e4a", "#99f6e4"],
  ["#7c2d12", "#fed7aa"],
  ["#831843", "#fbcfe8"],
  ["#365314", "#d9f99d"],
] as const;

function tintOf(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return TINTS[sum % TINTS.length];
}

// A person in a shared tab, as their initial in a color their name picks, so
// the same person looks the same in every list.
export function PersonAvatar({
  name,
  size = 28,
  dot,
}: {
  name: string;
  size?: number;
  dot?: "live" | "away" | "reconnecting";
}) {
  const [bg, fg] = tintOf(name);
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="flex h-full w-full items-center justify-center rounded-full font-bold"
        style={{ background: bg, color: fg, fontSize: Math.round(size * 0.4) }}
      >
        {initial}
      </span>
      {dot && (
        <span
          aria-hidden
          className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg-primary)] ${
            dot === "live"
              ? "bg-[var(--accent-green)]"
              : dot === "reconnecting"
                ? "bg-[var(--accent-amber)]"
                : "bg-[var(--text-muted)]"
          }`}
        />
      )}
    </span>
  );
}
