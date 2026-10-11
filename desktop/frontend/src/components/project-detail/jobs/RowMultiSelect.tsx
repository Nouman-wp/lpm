import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";

// The multi-select sibling of RowSelect: a quiet trigger summarizing the picked
// projects, opening the same anchored, portaled list — but each row is a
// checkbox that toggles membership and leaves the menu open. No value stands for
// "every project" here; an empty selection reads as "Standalone".
export function RowMultiSelect({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const summary =
    value.length === 0
      ? "Standalone"
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `${value.length} projects`;

  const toggle = (v: string) => {
    onChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  };

  return (
    <RowMenu
      label={summary}
      menuClassName="w-max min-w-[220px] max-w-[min(360px,calc(100vw-32px))] overflow-y-auto p-1"
    >
      {() =>
        options.length === 0 ? (
          <p className="px-2.5 py-1.5 text-[13px] text-[var(--text-muted)]">
            No projects yet.
          </p>
        ) : (
          options.map((o) => (
            <RowMenuItem
              key={o.value}
              label={o.label}
              active={value.includes(o.value)}
              onClick={() => toggle(o.value)}
            />
          ))
        )
      }
    </RowMenu>
  );
}
