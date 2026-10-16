// A pane's tab ids rearranged to follow `order`: the tabs it names take its
// relative order, in the slots those tabs held, and the rest stay put. Null when
// that changes nothing.
export function paneOrderFollowing(paneIds: string[], order: string[]): string[] | null {
  const rank = new Map(order.map((id, i) => [id, i]));
  const slots = paneIds.flatMap((id, i) => (rank.has(id) ? [i] : []));
  if (slots.length < 2) return null;
  const ranked = slots.map((i) => paneIds[i]).sort((a, b) => rank.get(a)! - rank.get(b)!);
  const next = [...paneIds];
  slots.forEach((slot, k) => (next[slot] = ranked[k]));
  return next.every((id, i) => id === paneIds[i]) ? null : next;
}
