import { CircleCheck } from "lucide-react";
import type { Fix } from "@/lib/github-fixes";

const DAY_MS = 24 * 60 * 60 * 1000;

function turnaround(fix: Fix): string {
  const days = Math.floor(
    (Date.parse(fix.fixedAt) - Date.parse(fix.reportedAt)) / DAY_MS,
  );
  if (days < 1) return "fixed in under a day";
  return `fixed in ${days} ${days === 1 ? "day" : "days"}`;
}

// The latest reports from users that were closed as fixed, with how long each
// took: how issues are handled, shown rather than claimed.
export function RecentFixes({ fixes }: { fixes: Fix[] }) {
  if (fixes.length === 0) return null;
  return (
    <div className="mx-auto mt-10 max-w-2xl text-left">
      <h3 className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        Recently fixed from your reports
      </h3>
      <ul className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
        {fixes.map((fix) => (
          <li
            key={fix.number}
            className="border-t border-gray-100 first:border-t-0 dark:border-white/[0.06]"
          >
            <a
              href={fix.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 px-4 py-3 transition-colors hover:bg-gray-50 sm:grid-cols-[auto_minmax(0,1fr)_auto] dark:hover:bg-white/[0.03]"
            >
              <CircleCheck
                className="h-4 w-4 text-[#8250df] dark:text-[#a371f7]"
                aria-hidden="true"
              />
              <span className="truncate text-sm text-gray-900 group-hover:underline group-hover:decoration-gray-300 group-hover:underline-offset-4 dark:text-gray-100 dark:group-hover:decoration-gray-600">
                {fix.title}
              </span>
              <span className="col-start-2 text-xs tabular-nums text-gray-500 sm:col-start-auto dark:text-gray-400">
                #{fix.number} · {turnaround(fix)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
