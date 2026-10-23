import { ArrowRight } from "lucide-react";
import { AGENT_COUNT, SERVICE_COUNT } from "./before-after-data";
import { WINDOW_COUNT } from "./before-after-legend";

// The section's result, read before the pictures that prove it.
export function BeforeAfterClaim() {
  return (
    <div className="mb-10 text-center sm:mb-12">
      <p className="flex items-baseline justify-center gap-3 text-3xl font-extrabold tracking-tight tabular-nums sm:gap-4 sm:text-4xl">
        <span className="sr-only">
          From {WINDOW_COUNT.before} to {WINDOW_COUNT.after}
        </span>
        <s
          aria-hidden="true"
          className="font-bold text-gray-500 decoration-2"
        >
          {WINDOW_COUNT.before}
        </s>
        <ArrowRight
          aria-hidden="true"
          className="h-6 w-6 shrink-0 self-center text-gray-400 sm:h-7 sm:w-7 dark:text-gray-500"
        />
        <span aria-hidden="true" className="text-gray-900 dark:text-white">
          {WINDOW_COUNT.after}
        </span>
      </p>
      <p className="mt-3 text-pretty text-sm text-gray-500 sm:text-base dark:text-gray-400">
        Same {SERVICE_COUNT} services and {AGENT_COUNT} agents, and a sidebar
        that shows which one needs you.
      </p>
    </div>
  );
}
