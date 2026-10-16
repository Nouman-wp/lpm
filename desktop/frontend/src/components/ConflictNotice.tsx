import { main } from "../../bridge/models";

const SHOWN = 3;

export function ConflictNotice({ files }: { files: main.ChangedFile[] }) {
  const paths = files.filter((f) => f.status === "conflicted").map((f) => f.path);
  if (paths.length === 0) return null;
  const named =
    paths.length > SHOWN ? `${paths.slice(0, SHOWN).join(", ")} and ${paths.length - SHOWN} more` : paths.join(", ");
  return (
    <p className="rounded-md bg-[var(--accent-red)]/10 px-2.5 py-1.5 text-[11px] text-[var(--accent-red-text)]">
      {named} {paths.length === 1 ? "has" : "have"} merge conflicts. Resolve the conflict markers
      (&lt;&lt;&lt;&lt;&lt;&lt;&lt; … &gt;&gt;&gt;&gt;&gt;&gt;&gt;) before committing.
    </p>
  );
}
