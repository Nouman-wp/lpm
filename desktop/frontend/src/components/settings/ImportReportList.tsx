export function ImportReportList({ items, mono }: { items: string[]; mono?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-1 text-xs ${mono ? "font-mono" : ""}`}>
      {items.map((item) => (
        <li
          key={item}
          className="rounded bg-[var(--bg-active)] px-2 py-0.5 text-[var(--text-secondary)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
