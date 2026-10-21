// A numbered pointer on the picture, matched by the legend under it.
export default function CalloutMark({
  n,
  className = "",
}: {
  n: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-900 shadow-[0_0_0_3px_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.5)] sm:h-5 sm:w-5 sm:text-[11px] ${className}`}
    >
      {n}
    </span>
  );
}
