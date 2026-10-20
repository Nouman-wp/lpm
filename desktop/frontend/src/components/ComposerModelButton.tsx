import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Cpu, Loader2 } from "lucide-react";
import { useAnchoredPanel } from "../hooks/useAnchoredPanel";
import { useOverlay } from "../store/overlay";
import {
  effortLabel,
  modelLabel,
  pickSummary,
  switchEffortUnion,
  switchEfforts,
  switchModels,
  type ModelPick,
  type SwitchableCLI,
} from "../agentModelSwitch";
import { menuCommit } from "../agentModelMenu";
import { recentModels, rememberModel, splitModels } from "../modelSwitchRecents";
import { useAgentModelMenuKeys } from "../hooks/useAgentModelMenuKeys";
import type { ComposerToolPresentation } from "../composerTools";
import type { AIModelOption } from "../types";
import { ComposerModelPanel } from "./ComposerModelPanel";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { Tooltip } from "./ui/Tooltip";
import { COMPOSER_TOOLTIP_DELAY_MS } from "../composerText";

const PANEL_WIDTH = 320;

export interface ComposerModelButtonProps {
  // Which agent runs in the target terminal — it decides both the model list and
  // how a pick is delivered.
  cli: SwitchableCLI;
  // What lpm last saw the session running. Either half may be empty when that
  // half was never observed, which just leaves its rows unchecked.
  pick: ModelPick;
  // True while a switch is in flight; the trigger locks so two can't interleave.
  applying: boolean;
  // Re-read the running model from the pane and hand the reading back, so the
  // menu can open on what is running. The `pick` prop is a render too old to
  // carry a reading taken in this same click.
  onOpen: () => ModelPick;
  onPick: (want: Partial<ModelPick>) => void;
}

interface ModelOrder {
  top: AIModelOption[];
  rest: AIModelOption[];
}

// Footer control that re-points the running agent at another model or reasoning
// level, from one panel: a model is picked from the list, then its level from
// the row beneath it.
export function ComposerModelButton({
  cli,
  pick,
  applying,
  onOpen,
  onPick,
  variant = "button",
  onOpenChange,
}: ComposerModelButtonProps & ComposerToolPresentation) {
  const [open, setOpen] = useState(false);
  // The model the level row belongs to and the level picked for it. Nothing is
  // applied until a level is clicked or the pick is committed.
  const [cursorModel, setCursorModel] = useState("");
  const [cursorEffort, setCursorEffort] = useState("");
  // Fixed when the menu opens, so rows don't reshuffle under the pointer.
  const [order, setOrder] = useState<ModelOrder>({ top: [], rest: [] });
  const [showMore, setShowMore] = useState(false);
  // Enter only commits once the keyboard has actually been used to move the
  // cursor. Opened by mouse and left alone, the menu must not take an Enter the
  // user meant for the prompt they were writing.
  const keyboardUsed = useRef(false);
  const rowId = useId();

  // The button sits at the composer's right edge beside Send, so the panel
  // hangs off its right edge; as a row in the More menu it hangs off the left.
  const { triggerRef, panelRef, style } = useAnchoredPanel<HTMLDivElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: PANEL_WIDTH,
    side: "above",
    align: variant === "row" ? "left" : "right",
    flip: true,
  });

  useOverlay(open);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const models = useMemo(() => switchModels(cli), [cli]);
  const modelValues = useMemo(
    () => [...order.top, ...order.rest].map((m) => m.value),
    [order],
  );
  // Every level any model of this CLI offers. The row renders the union and
  // greys out what the cursor's model can't take, so it keeps one shape as the
  // cursor moves and shows *why* a level is missing: Haiku's Ultracode is
  // visibly unavailable rather than quietly absent.
  const levelRows = useMemo(() => switchEffortUnion(cli), [cli]);
  const allowed = useMemo(
    () => new Set(switchEfforts(cli, cursorModel).map((e) => e.value)),
    [cli, cursorModel],
  );
  const levelValues = useMemo(
    () => levelRows.filter((x) => allowed.has(x.value)).map((x) => x.value),
    [levelRows, allowed],
  );
  // A level carried across models can be one the new model doesn't offer; read
  // through this and it highlights nothing and commits nothing.
  const effortCursor = allowed.has(cursorEffort) ? cursorEffort : "";

  const choose = useCallback(
    (want: Partial<ModelPick> | null) => {
      setOpen(false);
      if (!want) return;
      if (want.model) rememberModel(cli, want.model);
      onPick(want);
    },
    [cli, onPick],
  );

  // Onto the running model, the cursor takes the level it runs at; onto
  // another, it carries the level picked so far.
  const pointAt = useCallback(
    (model: string) => {
      setCursorModel(model);
      if (model === pick.model && pick.effort) setCursorEffort(pick.effort);
      if (order.rest.some((m) => m.value === model)) setShowMore(true);
    },
    [pick.model, pick.effort, order.rest],
  );
  // A click inside counts as using the menu, so Enter then commits what it shows.
  const selectModel = (model: string) => {
    keyboardUsed.current = true;
    if (switchEfforts(cli, model).length === 0) choose(menuCommit({ model, effort: "" }, pick));
    else pointAt(model);
  };
  const chooseLevel = (effort: string) => choose(menuCommit({ model: cursorModel, effort }, pick));
  const commit = useCallback(
    () => choose(menuCommit({ model: cursorModel, effort: effortCursor }, pick)),
    [choose, cursorModel, effortCursor, pick],
  );
  const close = useCallback(() => setOpen(false), []);

  useAgentModelMenuKeys({
    open,
    models: modelValues,
    levels: levelValues,
    model: cursorModel,
    effort: effortCursor,
    used: keyboardUsed,
    moveModel: pointAt,
    moveLevel: setCursorEffort,
    commit,
    close,
  });

  // Keep the keyboard cursor on screen once the list scrolls. Only for keyboard
  // moves: scrolling under the pointer would fight a mouse user.
  const activeRowId = `${rowId}-model-${cursorModel}`;
  useEffect(() => {
    if (!open || !keyboardUsed.current) return;
    document.getElementById(activeRowId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeRowId]);

  // Keep clicks from pulling focus off the composer editor; the caret stays put.
  const keepEditorFocus = (e: MouseEvent) => e.preventDefault();

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Seed from the reading onOpen just took, not from `pick` — that prop is
    // this render's, one behind the store write onOpen makes.
    const now = onOpen();
    keyboardUsed.current = false;
    setOrder(splitModels(models, now.model, recentModels(cli)));
    setShowMore(false);
    setCursorModel(now.model || models[0]?.value || "");
    setCursorEffort(now.effort);
    setOpen(true);
  };

  const summary = pickSummary(cli, pick);
  const modelText = pick.model ? modelLabel(cli, pick.model) : "";
  const effortText = pick.effort ? effortLabel(cli, pick.model, pick.effort) : "";

  return (
    <div ref={triggerRef} className={variant === "row" ? "min-w-0 flex-1" : undefined}>
      {variant === "row" ? (
        <ContextMenuItem
          label="Model"
          description={summary || "Not reported yet"}
          icon={<Cpu size={13} strokeWidth={1.75} />}
          trailing={applying ? <Loader2 size={12} className="animate-spin" /> : undefined}
          expanded={open}
          onMouseDown={keepEditorFocus}
          onClick={toggle}
          disabled={applying}
        />
      ) : (
      <Tooltip
        content={summary ? `Model  ·  ${summary}` : "Model"}
        delay={COMPOSER_TOOLTIP_DELAY_MS}
        disabled={open}
      >
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={toggle}
          disabled={applying}
          aria-label={summary ? `Model: ${summary}` : "Model"}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] leading-none transition-colors hover:bg-[var(--composer-hover-bg)] disabled:opacity-60 ${
            open ? "bg-[var(--composer-hover-bg)]" : ""
          }`}
        >
          {/* The model reads at full strength and the level sits beside it a
              shade quieter — the two halves are read as one phrase, not as a
              label and a tag. With nothing read back yet, a placeholder in the
              same quiet tone as the icons around it. */}
          {modelText ? (
            <>
              <span className="max-w-[112px] truncate text-[var(--composer-fg)]">{modelText}</span>
              {effortText && (
                <span className="max-w-[72px] truncate text-[var(--composer-fg-muted)]">
                  {effortText}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--composer-fg-muted)]">Model</span>
          )}
          {/* The spinner takes the chevron's slot rather than adding one, so a
              switch in flight doesn't shift the whole button row. */}
          {applying ? (
            <Loader2 size={12} className="shrink-0 animate-spin text-[var(--composer-fg-muted)]" />
          ) : (
            <ChevronDown
              size={12}
              strokeWidth={2}
              className="shrink-0 text-[var(--composer-fg-muted)]"
            />
          )}
        </button>
      </Tooltip>
      )}

      {open &&
        style &&
        createPortal(
          <ComposerModelPanel
            ref={panelRef}
            style={style}
            rowId={rowId}
            cli={cli}
            pick={pick}
            model={cursorModel}
            effort={effortCursor}
            top={order.top}
            rest={order.rest}
            showMore={showMore}
            levels={levelRows}
            allowed={allowed}
            onMouseDown={keepEditorFocus}
            onShowMore={() => setShowMore(true)}
            onSelectModel={selectModel}
            onChooseLevel={chooseLevel}
            onCommit={commit}
          />,
          document.body,
        )}
    </div>
  );
}
