import { AI_CLI_OPTIONS, aiEfforts } from "../../types";
import { levelBlurb, resolveNewTabPick, type NewTabPick } from "../../newTabPick";
import { ChoicePill } from "./ChoicePill";

const CAPTION = "mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

// The model and level an agent opens with, as two sets of pills. A new model
// keeps the level when the model takes it.
export function LauncherModelChoices({
  pick,
  onChange,
}: {
  pick: NewTabPick;
  onChange: (pick: NewTabPick) => void;
}) {
  const models = AI_CLI_OPTIONS.find((o) => o.value === pick.agent)?.models ?? [];
  const levels = aiEfforts(pick.agent, pick.model);
  const blurb = levelBlurb(pick.agent, pick.effort);

  return (
    <>
      <div className={CAPTION}>Model</div>
      <div role="radiogroup" aria-label="Model" className="flex flex-wrap gap-1">
        {models.map((m) => (
          <ChoicePill
            key={m.value || "default"}
            checked={pick.model === m.value}
            onClick={() => onChange(resolveNewTabPick({ ...pick, model: m.value }))}
          >
            {m.label}
          </ChoicePill>
        ))}
      </div>
      <div className={`${CAPTION} mt-2.5`}>Level</div>
      <div role="radiogroup" aria-label="Level" className="flex flex-wrap gap-1">
        {levels.map((l) => (
          <ChoicePill
            key={l.value || "default"}
            checked={pick.effort === l.value}
            onClick={() => onChange({ ...pick, effort: l.value })}
          >
            {l.label}
          </ChoicePill>
        ))}
      </div>
      {blurb && <p className="mt-1.5 text-[11px] leading-[15px] text-[var(--text-muted)]">{blurb}</p>}
    </>
  );
}
