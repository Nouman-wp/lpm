import { create } from "zustand";

// Terminals whose process has ended, with the code it exited with (null when
// the session went without one). Their composer gives way to a notice that
// offers a restart, since no input can reach them any more.
interface EndedTerminalsState {
  ended: Record<string, number | null>;
  mark: (id: string, code: number | null) => void;
  forget: (id: string) => void;
}

export const useEndedTerminals = create<EndedTerminalsState>((set) => ({
  ended: {},
  mark: (id, code) =>
    set((s) => (id in s.ended ? s : { ended: { ...s.ended, [id]: code } })),
  forget: (id) =>
    set((s) => {
      if (!(id in s.ended)) return s;
      const { [id]: _gone, ...rest } = s.ended;
      return { ended: rest };
    }),
}));
