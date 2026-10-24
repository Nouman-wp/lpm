import { ChevronLeftIcon } from "./icons";

interface InstructionsHeaderProps {
  title: string;
  description: string;
  onBack: () => void;
  backTitle: string;
}

export function InstructionsHeader({ title, description, onBack, backTitle }: InstructionsHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title={backTitle}
          aria-label={backTitle}
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{description}</p>
    </>
  );
}
