import { useSettingsStore } from "../../store/settings";
import { Tooltip } from "../ui/Tooltip";
import {
  RECAP_DEFAULT_THEME,
  RECAP_GLOW_DEG,
  RECAP_THEMES,
  type RecapTheme,
} from "./recapCardTheme";

const THEMES: { id: RecapTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "green", label: "lpm green" },
];

/** The card's look, for the feed it's going to. */
export function RecapThemePicks({ theme }: { theme: RecapTheme }) {
  const update = useSettingsStore((s) => s.update);

  return (
    <div role="group" aria-label="Card theme" className="flex items-center gap-1">
      {THEMES.map(({ id, label }) => {
        const colors = RECAP_THEMES[id];
        const on = id === theme;
        return (
          <Tooltip key={id} content={label} delay={300}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={on}
              onClick={() =>
                void update({ weeklyRecapTheme: id === RECAP_DEFAULT_THEME ? undefined : id })
              }
              className={`grid size-6 place-items-center rounded-md border transition-colors ${
                on ? "border-[var(--text-primary)]" : "border-transparent hover:border-[var(--border)]"
              }`}
            >
              <span
                className="block size-4 rounded"
                style={{
                  background: `linear-gradient(${RECAP_GLOW_DEG}deg, ${colors.glow} 0%, ${colors.ground} 55%)`,
                  border: `1px solid ${colors.border}`,
                }}
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
