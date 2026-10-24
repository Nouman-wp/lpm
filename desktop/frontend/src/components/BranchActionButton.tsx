import type { ReactNode } from "react";

export function BranchActionButton({
  title,
  onClick,
  children,
  danger = false,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-active)] ${danger ? "hover:text-[var(--accent-red)]" : "hover:text-[var(--text-primary)]"}`}
    >
      {children}
    </button>
  );
}
