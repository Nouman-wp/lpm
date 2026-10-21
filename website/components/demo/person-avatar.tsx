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

// Ports the app's PersonAvatar: a person in a shared tab, as their initial in a
// color their name picks.
export function PersonAvatar({ name, live }: { name: string; live?: boolean }) {
  const [bg, fg] = tintOf(name);
  return (
    <span className="relative inline-flex h-7 w-7 shrink-0">
      <span
        aria-hidden
        className="flex h-full w-full items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: bg, color: fg }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </span>
      {live && (
        <span
          aria-hidden
          className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-[#4ade80] ring-2 ring-[#1a1a1a]"
        />
      )}
    </span>
  );
}
