import { useState } from "react";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import type { ActionConfigLayer } from "../../actionConfig";
import { CheckIcon, ChevronDownIcon, FolderIcon } from "../icons";

interface LayerChoice {
  value: ActionConfigLayer;
  label: string;
  // The label as it reads after "Saves for".
  inline: string;
  hint: string;
}

// Named by who gets the action, not by the config file it lands in.
function configLayerChoices(project: string): LayerChoice[] {
  return [
    {
      value: "project",
      label: `Just me, in ${project}`,
      inline: `just me, in ${project}`,
      hint: "Only you see it. It stays out of the repo.",
    },
    {
      value: "repo",
      label: `Everyone on ${project}`,
      inline: `everyone on ${project}`,
      hint: "Saved in the repo, so teammates get it too",
    },
    {
      value: "global",
      label: "All my projects",
      inline: "all my projects",
      hint: "Shows up in every project",
    },
  ];
}

export function ConfigLayerMenu({
  project,
  value,
  onChange,
}: {
  project: string;
  value: ActionConfigLayer;
  onChange: (next: ActionConfigLayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false), open);
  const choices = configLayerChoices(project);
  const current = choices.find((c) => c.value === value) ?? choices[0];

  const choose = (next: ActionConfigLayer) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 text-[11px] transition-colors ${
          open
            ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
        }`}
      >
        <FolderIcon />
        <span>
          Saves for <span className="text-[var(--text-secondary)]">{current.inline}</span>
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[280px] rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-1 shadow-2xl">
          {choices.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--text-primary)]">
                  {active && <CheckIcon />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`truncate text-[12px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
