import { AI_CLI_OPTIONS } from "../../../types";
import { effortsFor, MODEL_OPTIONS } from "../../../agentModelOptions";
import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";

export interface ModelPick {
  agent: string;
  model: string;
  effort: string;
}

const HEADER_CLASS =
  "px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

function revealActive(el: HTMLElement | null) {
  el?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
}

// Model and reasoning effort in one picker: the models grouped by agent, with
// the picked model's effort levels beside them. Picking a model keeps the menu
// open for its effort; picking an effort closes it.
export function RowModelSelect({
  agent,
  model,
  effort,
  onChange,
}: ModelPick & { onChange: (pick: ModelPick) => void }) {
  const efforts = effortsFor(agent, model);
  const modelLabel =
    MODEL_OPTIONS.find((o) => o.value === `${agent}|${model}`)?.label ?? (model || agent);
  const effortLabel = effort ? efforts.find((e) => e.value === effort)?.label : undefined;

  const pickModel = (nextAgent: string, nextModel: string, close: () => void) => {
    const nextEfforts = effortsFor(nextAgent, nextModel);
    onChange({
      agent: nextAgent,
      model: nextModel,
      effort: nextEfforts.some((e) => e.value === effort) ? effort : "",
    });
    if (nextEfforts.length === 0) close();
  };

  return (
    <RowMenu
      label={effortLabel ? `${modelLabel} · ${effortLabel}` : modelLabel}
      menuClassName="flex overflow-hidden"
    >
      {(close) => (
        <>
          {efforts.length > 0 && (
            <div className="flex w-36 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-secondary)]/40 p-1">
              <div className={HEADER_CLASS}>Effort</div>
              {efforts.map((e) => (
                <RowMenuItem
                  key={e.value || "default"}
                  label={e.label}
                  active={e.value === effort}
                  onClick={() => {
                    onChange({ agent, model, effort: e.value });
                    close();
                  }}
                />
              ))}
            </div>
          )}
          <div ref={revealActive} className="flex w-52 flex-col overflow-y-auto p-1">
            <RowMenuItem
              label="Default"
              active={agent === "" && model === ""}
              onClick={() => pickModel("", "", close)}
            />
            {AI_CLI_OPTIONS.map((cli) => (
              <div key={cli.value}>
                <div className={HEADER_CLASS}>{cli.label}</div>
                {(cli.models ?? [{ value: "", label: "Default" }]).map((m) => (
                  <RowMenuItem
                    key={m.value || "default"}
                    label={m.label}
                    active={agent === cli.value && model === m.value}
                    onClick={() => pickModel(cli.value, m.value, close)}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </RowMenu>
  );
}
