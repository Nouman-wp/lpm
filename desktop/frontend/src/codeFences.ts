// An AI reply's YAML without the ```yaml fence a model wraps it in.
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:yaml|yml)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = trimmed.match(fence);
  return (m ? m[1] : trimmed).trim();
}
