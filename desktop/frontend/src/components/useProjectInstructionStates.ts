import { useEffect, useState } from "react";
import { ReadProjectInstructions } from "../../bridge/commands";

type InstructionState = { custom: false } | { custom: true; firstLine: string };

// A project overrides the defaults once any of its texts has a non-blank line,
// the same test the backend uses when it picks which instructions to apply.
export function instructionState(texts: string[]): InstructionState {
  for (const text of texts) {
    const line = text.split("\n").map((l) => l.trim()).find(Boolean);
    if (line) return { custom: true, firstLine: line };
  }
  return { custom: false };
}

export function useProjectInstructionStates(
  projectName: string,
  sections: { id: string; keys: string[] }[],
  // Read again each time the list comes back on screen, after an editor.
  shown: boolean,
): Record<string, InstructionState> {
  const [states, setStates] = useState<Record<string, InstructionState>>({});

  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    void Promise.all(
      sections.map(async ({ id, keys }) => {
        try {
          const texts = await Promise.all(
            keys.map((key) => ReadProjectInstructions(projectName, key) as Promise<string>),
          );
          return [id, instructionState(texts.map((t) => (typeof t === "string" ? t : "")))] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStates(Object.fromEntries(entries.filter((e) => e !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [projectName, sections, shown]);

  return states;
}
