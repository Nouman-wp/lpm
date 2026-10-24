import { useEffect, useState } from "react";
import { loadUnsavedWork, type UnsavedWork } from "../unsavedWork";

// undefined while checking; null when the folder isn't a Git repository.
export function useUnsavedWork(root: string): UnsavedWork | null | undefined {
  const [work, setWork] = useState<UnsavedWork | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setWork(undefined);
    loadUnsavedWork(root)
      .then((found) => live && setWork(found))
      .catch(() => live && setWork(null));
    return () => {
      live = false;
    };
  }, [root]);
  return work;
}
