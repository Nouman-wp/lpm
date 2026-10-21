import { serviceCrashed } from "../../serviceExit";

// Running, crashed or stopped, for a service's column header.
export function ServiceStateDot({ exited, exitCode }: { exited?: boolean; exitCode?: number | null }) {
  const color = !exited
    ? "bg-[var(--accent-green)]"
    : serviceCrashed({ exited: true, exitCode })
      ? "bg-[var(--accent-red)]"
      : "bg-[var(--text-muted)]";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />;
}
