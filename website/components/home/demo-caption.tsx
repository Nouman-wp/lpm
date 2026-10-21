type Props = {
  heading: string;
  blurb: string;
  phoneHeading: string;
  phoneBlurb: string;
  headingId: string;
  steps: number;
};

export function DemoCaption({
  heading,
  blurb,
  phoneHeading,
  phoneBlurb,
  headingId,
  steps,
}: Props) {
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
        <span
          className="relative hidden h-1.5 w-1.5 md:inline-flex"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="md:hidden">See it in action</span>
        <span className="hidden md:inline">Live demo · {steps} steps</span>
      </span>
      <div className="min-w-0">
        <h2 className="text-balance text-lg font-bold tracking-tight sm:text-xl md:hidden">
          {phoneHeading}
        </h2>
        <h2
          id={headingId}
          className="hidden text-balance text-lg font-bold tracking-tight sm:text-xl md:block"
        >
          {heading}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-pretty text-[13px] leading-relaxed text-gray-500 md:max-w-2xl md:text-[15px] md:text-gray-600 dark:text-gray-400 md:dark:text-gray-400">
          <span className="md:hidden">{phoneBlurb}</span>
          <span className="hidden md:inline">{blurb}</span>
        </p>
      </div>
    </div>
  );
}
