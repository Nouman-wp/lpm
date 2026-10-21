export type VerdictCard = {
  label: string;
  title: string;
  body: string;
};

type Props = {
  cards: [VerdictCard, VerdictCard, VerdictCard];
};

export function VerdictCards({ cards }: Props) {
  return (
    <div className="grid gap-4 text-left md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-transparent"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {card.label}
          </p>
          <h2 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
            {card.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {card.body}
          </p>
        </article>
      ))}
    </div>
  );
}
