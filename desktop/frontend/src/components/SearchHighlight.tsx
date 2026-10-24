import { highlightParts } from "../settingsSearchHits";

export function SearchHighlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-[3px] bg-[color-mix(in_srgb,var(--accent-amber)_30%,transparent)] px-px text-inherit"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
