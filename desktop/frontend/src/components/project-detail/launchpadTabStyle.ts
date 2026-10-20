// The look shared by every tab in the launchpad's row, picked or not. A split
// tab hovers each of its halves instead of the whole.
export function launchpadTabClass(checked: boolean, hover = true): string {
  const tone = checked
    ? "bg-[var(--composer-active-bg)] text-[var(--text-primary)]"
    : `text-[var(--text-secondary)] ${hover ? "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" : ""}`;
  return `flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg text-[12px] font-medium transition-colors [&>svg]:h-[14px] [&>svg]:w-[14px] ${tone}`;
}
