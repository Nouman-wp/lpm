import { useEffect } from "react";
import { toast } from "../notifications/toast";
import { TakeUpdateNote } from "../../bridge/commands";

interface UpdateNote {
  from: string;
  to: string;
}

// An update restarts lpm, often with nobody watching: the window it comes back
// to says which one it was.
export function useUpdateNote() {
  useEffect(() => {
    TakeUpdateNote().then(
      (note: UpdateNote | null) => {
        if (note) toast.success(`lpm updated from ${note.from} to ${note.to}`);
      },
      () => {},
    );
  }, []);
}
