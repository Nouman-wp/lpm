import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useEventListener } from "../../hooks/useEventListener";
import { useSettingsEscape } from "../../hooks/useSettingsEscape";
import {
  buildSearchEntries,
  matchSettings,
  TAB_TITLES,
  visibleNavGroups,
  type SettingsNavGroup,
  type SettingsSearchEntry,
} from "../../settings-registry";
import type { SettingsMachine } from "../../settingsMachine";
import { shortcutRequirementHint } from "../../shortcutRecord";
import { useAppStore, type SettingsTab, type View } from "../../store/app";
import { settingsReturnLabel, useSettingsReturn } from "../../store/settingsReturn";
import { useSettingsStore } from "../../store/settings";
import { applyTheme } from "../../theme";
import { NAV_ICONS } from "./navIcons";
import { SettingsNav } from "./SettingsNav";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { SettingsPanes } from "./SettingsPanes";
import { SettingsTargetContext, type SettingsTarget } from "./settingsTarget";

const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const PAGE_SUBTITLES: Partial<Record<SettingsTab, string>> = {
  shortcuts: `Click a shortcut, then press the keys you want. ${shortcutRequirementHint()}`,
};

// The page last open, unless the machine shown has no such page.
function shownTab(groups: SettingsNavGroup[], tab: SettingsTab): SettingsTab {
  const listed = groups.some((g) => g.items.some((item) => item.kind === "tab" && item.tab === tab));
  return listed ? tab : "general";
}

export function SettingsLayout({
  machine,
  target,
  notice,
  picker,
  onNavigate,
}: {
  machine: SettingsMachine;
  /// Null until the machine's settings can be shown; `notice` says why meanwhile.
  target: SettingsTarget | null;
  notice?: ReactNode;
  picker: ReactNode;
  onNavigate: (view: View) => void;
}) {
  const localTheme = useSettingsStore((s) => s.theme);
  const activeTab = useAppStore((s) => s.settingsTab);
  const setActiveTab = useAppStore((s) => s.setSettingsTab);
  const setUsageOpen = useAppStore((s) => s.setUsageOpen);
  const setView = useAppStore((s) => s.setView);
  const returnView = useSettingsReturn((s) => s.from);
  const [query, setQuery] = useState("");
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);

  const experimentalTTS = Boolean(target?.settings.experimentalTTS);
  const navGroups = useMemo(
    () => visibleNavGroups({ experimentalTTS }, machine),
    [experimentalTTS, machine],
  );
  const searchEntries = useMemo(
    () => buildSearchEntries({ experimentalTTS, machine }),
    [experimentalTTS, machine],
  );
  const searchResults = useMemo(() => matchSettings(searchEntries, query), [searchEntries, query]);
  const tab = shownTab(navGroups, activeTab);

  const activateEntry = (entry: SettingsSearchEntry) => {
    setQuery("");
    if (entry.kind === "view") {
      onNavigate(entry.view);
    } else if (entry.kind === "modal") {
      if (entry.modal === "usage") setUsageOpen(true);
    } else {
      setActiveTab(entry.tab);
      setPendingRevealId(entry.id);
    }
  };

  useEffect(() => {
    if (!pendingRevealId) return;
    const id = pendingRevealId;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-settings-row="${id}"]`);
        if (el) {
          // A setting folded under a disclosure is shown before it is pointed at.
          if (el instanceof HTMLDetailsElement) el.open = true;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          el.classList.add("settings-search-flash");
          window.setTimeout(() => el.classList.remove("settings-search-flash"), 1500);
        }
        setPendingRevealId(null);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [pendingRevealId]);

  useEventListener("change", () => applyTheme("system"), darkModeQuery, localTheme === "system");
  const leave = () => setView(returnView);
  useSettingsEscape(leave);

  return (
    <div className="-mx-6 -mb-6 flex flex-1 overflow-hidden">
      <SettingsNav
        backLabel={settingsReturnLabel(returnView)}
        onBack={leave}
        picker={picker}
        groups={navGroups}
        activeTab={tab}
        query={query}
        results={searchResults}
        onQueryChange={setQuery}
        onActivate={activateEntry}
        onSelectTab={setActiveTab}
        onNavigate={onNavigate}
      />

      <div className="flex-1 overflow-y-auto">
        <div key={tab} className="settings-pane-in mx-auto max-w-2xl px-10 pt-8 pb-10">
          <SettingsPageHeader
            icon={NAV_ICONS[tab]}
            title={TAB_TITLES[tab]}
            description={PAGE_SUBTITLES[tab]}
            machineName={machine.kind === "peer" ? machine.name : undefined}
          />
          {target ? (
            <SettingsTargetContext.Provider value={target}>
              <SettingsPanes tab={tab} onNavigate={onNavigate} />
            </SettingsTargetContext.Provider>
          ) : (
            notice
          )}
        </div>
      </div>
    </div>
  );
}
