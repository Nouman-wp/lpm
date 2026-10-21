// Cuts the middle out of a long name so both ends stay readable: a branch's
// prefix says what kind it is, and its ending tells it from its siblings.
export function middleTruncate(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const keep = max - 1;
  const head = Math.floor(keep * 0.45);
  return `${chars.slice(0, head).join("")}…${chars.slice(chars.length - (keep - head)).join("")}`;
}
