import { useEffect } from "react";
import { Users } from "lucide-react";
import { useTabShares, watchTabShares, type JoinedTab } from "../../store/tabShares";
import { useAppStore } from "../../store/app";
import { IS_MIRROR_WINDOW } from "../../mirror";

function statusDot(tab: JoinedTab): string {
  if (tab.ended) return "bg-[var(--text-muted)]/40";
  return tab.connected ? "bg-[var(--accent-green)]" : "bg-[var(--accent-amber)]";
}

// Tabs other people shared with this machine. Shown only while there are some,
// and only in the main window, which is where they open.
export function SidebarSharedTabs() {
  const joined = useTabShares((s) => s.joined);
  const openTab = useTabShares((s) => s.openTab);
  const setOpenTab = useTabShares((s) => s.setOpenTab);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => watchTabShares(), []);

  if (joined.length === 0 || IS_MIRROR_WINDOW) return null;
  return (
    <div className="mx-2 mb-2 border-t border-[var(--border)] pt-2">
      <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Shared with me
      </div>
      {joined.map((tab) => {
        const active = view === "shared" && openTab === tab.slug;
        return (
          <button
            key={tab.slug}
            type="button"
            onClick={() => {
              setOpenTab(tab.slug);
              setView("shared");
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
              active ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Users size={13} className="shrink-0 text-[var(--text-muted)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-[var(--text-primary)]">
                {tab.label || "Shared tab"}
              </span>
              <span className="block truncate text-[11px] text-[var(--text-muted)]">
                {tab.ended ? "Ended" : `from ${tab.hostName}`}
              </span>
            </span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(tab)}`} />
          </button>
        );
      })}
    </div>
  );
}
