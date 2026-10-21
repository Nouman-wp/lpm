import { useState, type CSSProperties, type MouseEvent, type Ref } from "react";
import { ChevronRight } from "lucide-react";
import { effortBlurb, menuEffect } from "../agentModelMenu";
import { effortLabel, modelLabel, type ModelPick, type SwitchableCLI } from "../agentModelSwitch";
import type { AIEffortOption, AIModelOption } from "../types";
import { ComposerLevelSegments } from "./ComposerLevelSegments";
import { ComposerModelCaption as Caption } from "./ComposerModelCaption";
import { ComposerModelMenuRow as Row } from "./ComposerModelMenuRow";

// Codex's longer model list scrolls past this rather than pushing the panel over
// the terminal output behind it.
const LIST_MAX_HEIGHT = 236;
const AGENT_NAMES: Record<SwitchableCLI, string> = { claude: "Claude Code", codex: "Codex" };

interface ComposerModelPanelProps {
  ref: Ref<HTMLDivElement>;
  style: CSSProperties;
  rowId: string;
  cli: SwitchableCLI;
  pick: ModelPick;
  // The cursor: the model the level row belongs to, and the level picked for it.
  model: string;
  effort: string;
  top: AIModelOption[];
  rest: AIModelOption[];
  showMore: boolean;
  levels: AIEffortOption[];
  allowed: ReadonlySet<string>;
  onMouseDown: (e: MouseEvent) => void;
  onShowMore: () => void;
  onSelectModel: (model: string) => void;
  onChooseLevel: (effort: string) => void;
  onCommit: () => void;
}

// The composer's model menu as one panel: the models, the levels of the one
// under the cursor in a row beneath them, and what a switch will send.
export function ComposerModelPanel({
  ref,
  style,
  rowId,
  cli,
  pick,
  model,
  effort,
  top,
  rest,
  showMore,
  levels,
  allowed,
  onMouseDown,
  onShowMore,
  onSelectModel,
  onChooseLevel,
  onCommit,
}: ComposerModelPanelProps) {
  // A level under the pointer, described in place of the picked one.
  const [hoverEffort, setHoverEffort] = useState<string | null>(null);
  const described = hoverEffort ?? effort;
  // What committing the cursor sends, said in words; "" when it is what runs.
  const effect = menuEffect(cli, { model, effort }, pick);
  const blurb = described ? effortBlurb(cli, described) : "";
  const renderRow = (m: AIModelOption) => (
    <Row
      key={m.value}
      id={`${rowId}-model-${m.value}`}
      label={m.label}
      checked={pick.model === m.value}
      cursor={model === m.value}
      onMouseDown={onMouseDown}
      onClick={() => onSelectModel(m.value)}
    />
  );

  return (
    <div
      ref={ref}
      style={style}
      role="menu"
      className="z-[80] flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl"
    >
      <Caption
        label="Model"
        // Nothing read back yet — a terminal that hasn't drawn its banner or
        // status line, or whose scrollback has outrun both — so say that rather
        // than show unchecked rows that read as "none set".
        note={!pick.model ? "not reported" : undefined}
        trailing={AGENT_NAMES[cli]}
      />
      <div style={{ maxHeight: LIST_MAX_HEIGHT }} className="shrink-0 overflow-y-auto pb-1.5">
        {top.map(renderRow)}
        {rest.length > 0 &&
          (showMore ? (
            rest.map(renderRow)
          ) : (
            <button
              type="button"
              onMouseDown={onMouseDown}
              onClick={onShowMore}
              className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12px] leading-4 text-[var(--text-muted)] transition-colors duration-75 hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            >
              <ChevronRight size={11} strokeWidth={2} className="-mx-0.5 shrink-0" />
              <span className="flex-1">More models</span>
              <span className="tabular-nums">{rest.length}</span>
            </button>
          ))}
      </div>

      <div className="border-t border-[var(--border)] pb-2">
        <Caption label="Level" />
        <ComposerLevelSegments
          idPrefix={`${rowId}-effort`}
          levels={levels}
          allowed={allowed}
          cursor={effort}
          running={model === pick.model ? pick.effort : ""}
          onMouseDown={onMouseDown}
          onHover={setHoverEffort}
          onChoose={onChooseLevel}
        />
        {/* Two lines held open, so the panel keeps its height as the
            description changes under the pointer. */}
        <p className="mt-1.5 line-clamp-2 min-h-[32px] px-3 text-[11.5px] leading-4 text-[var(--text-secondary)]">
          {described ? (
            <>
              <span className="font-medium text-[var(--text-primary)]">
                {effortLabel(cli, model, described)}
              </span>
              {blurb && ` — ${blurb}`}
            </>
          ) : (
            <span className="text-[var(--text-muted)]">Pick a level for {modelLabel(cli, model)}</span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
        <div className="flex min-h-6 items-center gap-2 text-[11px] leading-[15px]">
          {effect ? (
            <>
              <span className="min-w-0 flex-1 text-[var(--text-secondary)]">{effect}</span>
              <button
                type="button"
                onMouseDown={onMouseDown}
                onClick={onCommit}
                className="h-6 shrink-0 rounded-md bg-[var(--text-primary)] px-2.5 text-[11px] font-medium text-[var(--bg-primary)] transition-opacity hover:opacity-85"
              >
                Switch
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-[var(--text-muted)]">Pick a model, then its level</span>
              <span className="shrink-0 text-[10.5px] text-[var(--text-muted)]">↑↓ model · ←→ level</span>
            </>
          )}
        </div>
        {cli === "codex" && (
          // Codex's picker is the only way in, and confirming it writes
          // ~/.codex/config.toml — so a pick here moves every later codex
          // session too, not just this terminal. Worth saying out loud.
          <p className="text-[10.5px] leading-[14px] text-[var(--text-muted)]">
            Codex saves this as your default for new sessions too.
          </p>
        )}
      </div>
    </div>
  );
}
