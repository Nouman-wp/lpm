// Shape of one entry returned by the `detect_service_ports` command, and the
// shared parse into a name->ports map used by both the service-tab poller
// (useServicePorts) and the "Open in browser" menu (OpenInBrowserSubmenu).
export interface ServicePortsEntry {
  service: string;
  ports: number[];
}

export function parseServicePorts(res: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!Array.isArray(res)) return out;
  for (const entry of res as ServicePortsEntry[]) out[entry.service] = entry.ports ?? [];
  return out;
}

// Ports arrive sorted+deduped from the backend, so an element-wise compare is
// enough to tell whether anything changed — lets a poller keep the previous
// object reference and skip a re-render on every (usually-identical) look.
export function samePorts(
  a: Record<string, number[]>,
  b: Record<string, number[]>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (!bv || av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
  }
  return true;
}

// What a service's links point at: the ports it listens on, else (before the
// scan has seen it bind, or where nothing is scanned) the one its config names.
export function linkedPorts(detected: number[], configured: number, fallback: boolean): number[] {
  if (detected.length > 0) return detected;
  return fallback && configured > 0 ? [configured] : [];
}

// The configured port, when the service listens on others instead of it.
export function movedFromPort(detected: number[], configured: number): number | undefined {
  return configured > 0 && detected.length > 0 && !detected.includes(configured) ? configured : undefined;
}
