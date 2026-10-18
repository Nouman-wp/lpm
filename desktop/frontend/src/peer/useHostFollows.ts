import { useEffect, useSyncExternalStore } from "react";
import { askHostFollows, knownHostFollows, subscribeHostFollows } from "./hostFollows";

// Whether a paired machine's project is one whose tabs the machine keeps for
// every Mac (hostFollows). Undefined until it has said, and for this Mac's own.
export function useHostFollows(projectName: string): boolean | undefined {
  useEffect(() => {
    void askHostFollows(projectName);
  }, [projectName]);
  return useSyncExternalStore(subscribeHostFollows, () => knownHostFollows(projectName));
}
