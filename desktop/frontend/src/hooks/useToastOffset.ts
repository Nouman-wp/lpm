import { useLayoutEffect, useState } from "react";
import { useSonner } from "sonner";
import { TOAST_EDGE, toastFloor } from "../toasterOffset";

/** Where the main toaster sits, measured as its first toast appears: the
 *  composer under it can come and go with the selected tab. */
export function useToastOffset(dockInset: number) {
  const { toasts } = useSonner();
  const showing = toasts.some((t) => !t.toasterId);
  const right = dockInset + TOAST_EDGE;
  const [bottom, setBottom] = useState(TOAST_EDGE);

  useLayoutEffect(() => {
    if (showing) setBottom(toastFloor(right));
  }, [showing, right]);

  return { right, bottom };
}
