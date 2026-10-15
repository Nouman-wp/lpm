/** Where even use would put a usage bar by now: a tick that stands 3px proud of
 *  the bar it sits on, so it reads the same on a thin sidebar bar and a card's.
 *  `className` sets its own reach and width where a bar is split into lanes. */
export function PaceTick({
  at,
  dim = false,
  className = "inset-y-[-3px] w-0.5",
}: {
  at: number;
  dim?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -translate-x-1/2 rounded-full bg-[var(--text-primary)] ${className}`}
      style={{ left: `${at * 100}%`, opacity: dim ? 0.4 : 1 }}
    />
  );
}
