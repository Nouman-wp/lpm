import type { ComponentProps } from "react";
import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";

// A custom right-aligned dropdown that replaces the native <select>: a quiet
// trigger showing the current value, opening an anchored, scrollable list with a
// check on the selection.
export function RowSelect({
  value,
  onChange,
  options,
  ...trigger
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
} & Pick<ComponentProps<typeof RowMenu>, "variant" | "icon" | "ariaLabel">) {
  const selected = options.find((o) => o.value === value);
  return (
    <RowMenu
      {...trigger}
      label={selected?.label ?? ""}
      menuClassName="min-w-[200px] overflow-y-auto p-1"
    >
      {(close) =>
        options.map((o) => (
          <RowMenuItem
            key={o.value}
            label={o.label}
            active={o.value === value}
            onClick={() => {
              onChange(o.value);
              close();
            }}
          />
        ))
      }
    </RowMenu>
  );
}
