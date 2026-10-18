import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AI_CLI_OPTIONS, aiEfforts, type AICLI } from "../../types";
import {
  agentName,
  levelBlurb,
  modelName,
  resolveNewTabPick,
  type NewTabPick,
} from "../../newTabPick";
import { AgentGlyph } from "./AgentGlyph";
import { CascadeRow } from "./CascadeRow";

const AGENT_WIDTH = 184;
const MODEL_WIDTH = 176;
const LEVEL_WIDTH = 252;
const GAP = 4;
const MARGIN = 8;
// With less room than this under the chip, and more above it, the menu opens upward.
const MIN_SPACE_BELOW = 240;

const COLUMN =
  "flex min-h-0 shrink-0 flex-col overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] pb-1 shadow-xl";
const TITLE =
  "truncate px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

type Column = "agent" | "model" | "effort";

interface Placement {
  style: CSSProperties;
  maxHeight: number;
}

function placement(anchor: DOMRect): Placement {
  const width = AGENT_WIDTH + MODEL_WIDTH + LEVEL_WIDTH + 2 * GAP;
  const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - MARGIN - width));
  const below = window.innerHeight - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  if (below >= MIN_SPACE_BELOW || below >= above) {
    return { style: { left, top: anchor.bottom + GAP, alignItems: "flex-start" }, maxHeight: below };
  }
  return {
    style: { left, bottom: window.innerHeight - anchor.top + GAP, alignItems: "flex-end" },
    maxHeight: above,
  };
}

function stepped(list: string[], current: string, step: number): string {
  const i = list.indexOf(current);
  return list[i === -1 ? 0 : Math.min(list.length - 1, Math.max(0, i + step))];
}

// Agent ▸ model ▸ level, each column opening as the pointer (or the arrow keys)
// reaches a row of the one before. A click on any row opens with it: an agent
// row keeps what the pick already says for that agent, a model row keeps the
// level when the model takes it. The columns share one top edge rather than
// following the hovered row, so scanning a list doesn't move the next one.
export function AgentCascadeMenu({
  anchorRef,
  pick,
  onChoose,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  pick: NewTabPick;
  onChoose: (pick: NewTabPick) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const [column, setColumn] = useState<Column>("agent");
  const [agent, setAgent] = useState<AICLI>(pick.agent);
  const [model, setModel] = useState(pick.model);
  const [effort, setEffort] = useState(pick.effort);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPlace(placement(rect));
  }, [anchorRef]);
  const placed = place !== null;
  useEffect(() => {
    if (placed) rootRef.current?.focus({ preventScroll: true });
  }, [placed]);

  const kept = (id: AICLI) => (id === pick.agent ? pick : resolveNewTabPick({ agent: id }));
  const models = AI_CLI_OPTIONS.find((o) => o.value === agent)?.models ?? [];
  const levels = models.length > 0 ? aiEfforts(agent, model) : [];

  const pointAgent = (id: AICLI) => {
    setColumn("agent");
    setAgent(id);
    setModel(kept(id).model);
    setEffort(kept(id).effort);
  };
  const pointModel = (value: string) => {
    setColumn("model");
    setModel(value);
  };
  const pointLevel = (value: string) => {
    setColumn("effort");
    setEffort(value);
  };

  const chooseAgent = (id: AICLI) => onChoose(kept(id));
  const chooseModel = (value: string) =>
    onChoose(resolveNewTabPick({ agent, model: value, effort: kept(agent).effort }));
  const chooseLevel = (value: string) => onChoose(resolveNewTabPick({ agent, model, effort: value }));

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      if (column === "agent") {
        pointAgent(stepped(AI_CLI_OPTIONS.map((o) => o.value), agent, step) as AICLI);
      } else if (column === "model") {
        pointModel(stepped(models.map((m) => m.value), model, step));
      } else {
        pointLevel(stepped(levels.map((l) => l.value), effort, step));
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (column === "agent" && models.length > 0) {
        setColumn("model");
      } else if (column === "model" && levels.length > 0) {
        setColumn("effort");
        if (!levels.some((l) => l.value === effort)) setEffort(levels[0].value);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setColumn(column === "effort" ? "model" : "agent");
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (column === "agent") chooseAgent(agent);
      else if (column === "model") chooseModel(model);
      else chooseLevel(effort);
    }
  };

  if (!place) return null;
  const opened = pick.agent === agent;

  return createPortal(
    <div
      ref={rootRef}
      data-new-tab-popup
      role="menu"
      aria-label="Agent, model and level"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ position: "fixed", display: "flex", gap: GAP, ...place.style }}
      className="z-[81] outline-none"
    >
      <div className={COLUMN} style={{ width: AGENT_WIDTH, maxHeight: place.maxHeight }}>
        <div className={TITLE}>Agent</div>
        {AI_CLI_OPTIONS.map((o) => (
          <CascadeRow
            key={o.value}
            label={o.label}
            leading={<AgentGlyph agent={o.value} />}
            checked={pick.agent === o.value}
            cursor={agent === o.value}
            dim={column !== "agent"}
            more={(o.models?.length ?? 0) > 0}
            onMouseEnter={() => pointAgent(o.value)}
            onClick={() => chooseAgent(o.value)}
          />
        ))}
      </div>
      {models.length > 0 && (
        <div className={COLUMN} style={{ width: MODEL_WIDTH, maxHeight: place.maxHeight }}>
          <div className={TITLE}>{agentName(agent)} model</div>
          {models.map((m) => (
            <CascadeRow
              key={m.value || "default"}
              label={m.label}
              checked={opened && pick.model === m.value}
              cursor={model === m.value}
              dim={column === "effort"}
              more
              onMouseEnter={() => pointModel(m.value)}
              onClick={() => chooseModel(m.value)}
            />
          ))}
        </div>
      )}
      {levels.length > 0 && (
        <div className={COLUMN} style={{ width: LEVEL_WIDTH, maxHeight: place.maxHeight }}>
          <div className={TITLE}>Level · {modelName(agent, model)}</div>
          {levels.map((l) => (
            <CascadeRow
              key={l.value || "default"}
              label={l.label}
              sub={levelBlurb(agent, l.value)}
              checked={opened && pick.model === model && pick.effort === l.value}
              cursor={column === "effort" && effort === l.value}
              onMouseEnter={() => pointLevel(l.value)}
              onClick={() => chooseLevel(l.value)}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
