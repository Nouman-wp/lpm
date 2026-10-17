import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { SettingsNavGroup, SettingsSearchEntry } from "../../settings-registry";
import type { SettingsTab, View } from "../../store/app";
import { SettingsSearch } from "../SettingsSearch";
import { NAV_ICONS } from "./navIcons";

export function SettingsNav({
  picker,
  groups,
  activeTab,
  query,
  results,
  onQueryChange,
  onActivate,
  onSelectTab,
  onNavigate,
}: {
  /// Which machine's settings show, when there is more than one to choose.
  picker: ReactNode;
  groups: SettingsNavGroup[];
  activeTab: SettingsTab;
  query: string;
  results: SettingsSearchEntry[];
  onQueryChange: (query: string) => void;
  onActivate: (entry: SettingsSearchEntry) => void;
  onSelectTab: (tab: SettingsTab) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <nav className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-sidebar)] px-3 pt-6">
      <h1 className="mb-3 px-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
      {picker}
      <SettingsSearch
        query={query}
        onQueryChange={onQueryChange}
        results={results}
        onActivate={onActivate}
      />
      {query.trim() === "" &&
        groups.map((group) => (
          <div key={group.title} className="mb-2">
            <div className="mb-1 mt-3 px-2.5 text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--text-muted)] opacity-70">
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.kind === "view" ? item.view : item.tab];
              const active = item.kind === "tab" && activeTab === item.tab;
              return item.kind === "view" ? (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                >
                  {Icon && (
                    <Icon
                      size={15}
                      strokeWidth={1.75}
                      className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-secondary)]"
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  <ChevronRight size={13} className="shrink-0 opacity-50" />
                </button>
              ) : (
                <button
                  key={item.tab}
                  onClick={() => onSelectTab(item.tab)}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition-colors ${
                    active
                      ? "bg-[var(--bg-active)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {Icon && (
                    <Icon
                      size={15}
                      strokeWidth={active ? 2 : 1.75}
                      className={`shrink-0 transition-colors ${
                        active
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                      }`}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
    </nav>
  );
}
