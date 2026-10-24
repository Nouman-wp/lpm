interface ChartSegmentsProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function ChartSegments<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChartSegmentsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] ${
            option.value === value
              ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
