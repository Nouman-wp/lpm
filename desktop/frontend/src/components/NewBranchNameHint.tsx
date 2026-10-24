import { main } from "../../bridge/models";

interface NewBranchNameHintProps {
  slug: string;
  existing: main.Branch | null;
  current: boolean;
  onSwitch: () => void;
}

const code = "font-mono text-[11px]";

// What the typed name becomes, or the branch it would collide with.
export function NewBranchNameHint({ slug, existing, current, onSwitch }: NewBranchNameHintProps) {
  if (!slug) return null;
  if (current) {
    return (
      <p className="mt-1.5 text-[11px] text-[var(--accent-red-text)]">
        You're already on <code className={code}>{slug}</code>.
      </p>
    );
  }
  if (existing) {
    return (
      <p className="mt-1.5 text-[11px] text-[var(--accent-red-text)]">
        <code className={code}>{slug}</code> already exists{existing.remote ? ` on ${existing.remote}` : ""} ·{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-medium underline-offset-2 hover:underline"
        >
          Switch to it
        </button>
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
      Will create <code className={`${code} text-[var(--text-secondary)]`}>{slug}</code>
    </p>
  );
}
