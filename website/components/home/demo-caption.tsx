type Props = {
  heading: string;
  blurb: string;
  phoneHeading: string;
  phoneBlurb: string;
  headingId: string;
};

export function DemoCaption({
  heading,
  blurb,
  phoneHeading,
  phoneBlurb,
  headingId,
}: Props) {
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
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
