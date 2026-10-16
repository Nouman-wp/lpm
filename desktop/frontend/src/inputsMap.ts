// `inputs:` keyed by name, or the list lpm Link once wrote where each entry
// names itself with `key`. Both read as the map; a save writes the map.
export function inputsMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  if (!Array.isArray(value)) return value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { key, ...rest } = item as Record<string, unknown>;
    if ((typeof key === "string" && key) || typeof key === "number") out[String(key)] = rest;
  }
  return out;
}
