import type { ReactNode } from "react";
import { FileIcon } from "../icons";

export function BinaryFilePlaceholder({
  path,
  message = "Binary file not shown",
  children,
}: {
  path: string;
  message?: string;
  // What to do instead, under the path.
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
      <FileIcon size={22} />
      <span className="text-xs">{message}</span>
      <span className="max-w-[80%] truncate text-[11px] text-[var(--text-muted)]/70">
        {path}
      </span>
      {children}
    </div>
  );
}
