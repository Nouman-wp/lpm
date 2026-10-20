// Under a connected machine with nothing on it yet. Indented to the header's
// name, so it reads as that machine's first row.
export function SidebarHostEmptyRow({ alias, onAdd }: { alias: string; onAdd: () => void }) {
  return (
    <p className="py-1.5 pl-8 pr-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
      No projects on {alias} yet.{" "}
      <button
        type="button"
        onClick={onAdd}
        className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
      >
        Add a project
      </button>
    </p>
  );
}
