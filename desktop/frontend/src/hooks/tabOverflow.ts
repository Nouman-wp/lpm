export interface StripTabBox {
  key: string;
  left: number;
  right: number;
}

export interface HiddenTabs {
  left: string[];
  right: string[];
}

export const NO_HIDDEN_TABS: HiddenTabs = { left: [], right: [] };

// The tabs a strip can't show whole. On a side with more to scroll to, the
// count chip covers the edge, so any tab reaching into that zone is counted as
// hidden rather than left half-visible under it.
export function hiddenTabs(
  view: { left: number; right: number },
  tabs: StripTabBox[],
  edges: { left: boolean; right: boolean },
  zone: number,
): HiddenTabs {
  return {
    left: edges.left ? tabs.filter((t) => t.left < view.left + zone).map((t) => t.key) : [],
    right: edges.right ? tabs.filter((t) => t.right > view.right - zone).map((t) => t.key) : [],
  };
}

export function sameHiddenTabs(a: HiddenTabs, b: HiddenTabs): boolean {
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((k, i) => k === y[i]);
  return same(a.left, b.left) && same(a.right, b.right);
}
