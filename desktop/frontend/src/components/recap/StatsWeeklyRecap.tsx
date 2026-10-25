import { useMemo } from "react";
import { Share2 } from "lucide-react";
import { useSettingsStore } from "../../store/settings";
import { useWeeklyRecapStore } from "../../store/weeklyRecap";
import { daysBetween, localDate, weekStart } from "../stats/statsDates";
import { BTN_SECONDARY } from "../ui/buttons";
import { RecapCopyButton } from "./RecapCopyButton";
import { useWeeklyRecap } from "./useWeeklyRecap";
import { WeeklyRecapCard } from "./WeeklyRecapCard";
import { RECAP_NEWS_DAYS, recapView, recapWeekStart } from "./weeklyRecapModel";

/** Last week's recap at the top of Stats, while it's news. */
export function StatsWeeklyRecap() {
  const enabled = useSettingsStore((s) => s.weeklyRecap !== false);
  const hidden = useSettingsStore((s) => s.weeklyRecapHidden);
  const update = useSettingsStore((s) => s.update);
  const show = useWeeklyRecapStore((s) => s.show);
  const today = localDate();
  const week = recapWeekStart("last", today);
  const news = daysBetween(weekStart(today), today) < RECAP_NEWS_DAYS;
  const showing = enabled && news && hidden !== week;
  const { recap } = useWeeklyRecap(showing ? week : null);
  const view = useMemo(() => recap && recapView(recap), [recap]);

  if (!showing || !view || view.empty) return null;
  return (
    <div className="mb-4 flex w-[600px] max-w-full flex-col gap-3">
      <WeeklyRecapCard view={view} />
      <div className="flex flex-wrap items-center gap-2">
        <RecapCopyButton view={view} />
        <button
          type="button"
          onClick={() => show("last")}
          className={`${BTN_SECONDARY} inline-flex items-center gap-1.5`}
        >
          <Share2 size={13} />
          Share…
        </button>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          A fresh one every Monday ·{" "}
          <button
            type="button"
            onClick={() => void update({ weeklyRecapHidden: week })}
            className="font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
          >
            Hide until next week
          </button>
        </span>
      </div>
    </div>
  );
}
