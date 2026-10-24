// The page a Browser tab opens on as soon as it mounts, for a tab made to show
// one (a port link), keyed by tab id. Forgotten once the tab has opened it.
const startUrls = new Map<string, string>();

export function setBrowserStartUrl(id: string, url: string): void {
  startUrls.set(id, url);
}

export function browserStartUrl(id: string): string | undefined {
  return startUrls.get(id);
}

export function forgetBrowserStartUrl(id: string): void {
  startUrls.delete(id);
}

// Scheme, host and port: two addresses on the same dev server share it.
export function urlOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
