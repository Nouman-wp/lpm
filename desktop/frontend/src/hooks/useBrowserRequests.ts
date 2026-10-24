import { useEffect, useRef } from "react";
import { clearBrowserRequest, useBrowserRequest, type BrowserRequest } from "../store/browserRequest";

// Opens each page asked of this project (requestProjectBrowser) once the
// project is on screen, once per request.
export function useBrowserRequests(
  projectName: string,
  onScreen: boolean,
  open: (request: BrowserRequest) => void,
): void {
  const request = useBrowserRequest((s) => s.request);
  const openRef = useRef(open);
  openRef.current = open;
  const consumed = useRef(0);
  useEffect(() => {
    if (!request || request.projectName !== projectName || !onScreen || consumed.current === request.nonce) {
      return;
    }
    consumed.current = request.nonce;
    clearBrowserRequest();
    openRef.current(request);
  }, [request, projectName, onScreen]);
}
