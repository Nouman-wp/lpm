import { useEffect, useMemo, useState } from "react";
import { type Token, getLang, ensureLang, tokenizeLines } from "../highlight";
import { gutterDigits, hunkLabel, parseDiffRows, type DiffRow } from "./diffRows";

interface DiffViewerProps {
  diff: string;
  loading?: boolean;
  filePath?: string;
}

async function highlightRows(rows: DiffRow[], filePath: string): Promise<Map<number, Token[]>> {
  const lang = getLang(filePath);
  if (!lang || !(await ensureLang(lang))) return new Map();

  const oldIdx: number[] = [];
  const oldCode: string[] = [];
  const newIdx: number[] = [];
  const newCode: string[] = [];

  rows.forEach((row, i) => {
    if (row.kind !== "code") return;
    if (row.type !== "add") {
      oldIdx.push(i);
      oldCode.push(row.text);
    }
    if (row.type !== "del") {
      newIdx.push(i);
      newCode.push(row.text);
    }
  });

  const result = new Map<number, Token[]>();
  const fill = async (idx: number[], code: string[]) => {
    if (code.length === 0) return;
    const tokens = await tokenizeLines(code.join("\n"), lang);
    tokens.forEach((t, i) => {
      if (i < idx.length) result.set(idx[i], t);
    });
  };
  await fill(oldIdx, oldCode);
  await fill(newIdx, newCode);
  return result;
}

const MARKER = { add: "+", del: "-", ctx: " " } as const;
const ROW_BG = { add: "bg-green-500/10", del: "bg-red-500/10", ctx: "" } as const;
const FALLBACK_COLOR = {
  add: "text-green-400",
  del: "text-red-400",
  ctx: "text-[var(--text-muted)]",
} as const;
const GUTTER =
  "shrink-0 select-none pl-2 text-right tabular-nums text-[var(--text-muted)] opacity-60";

export function DiffViewer({ diff, loading, filePath }: DiffViewerProps) {
  const [tokenMap, setTokenMap] = useState<Map<number, Token[]>>(new Map());
  const rows = useMemo(() => parseDiffRows(diff), [diff]);
  const gutterWidth = { width: `calc(${gutterDigits(rows)}ch + 0.5rem)` };

  useEffect(() => {
    setTokenMap(new Map());
    if (!filePath || rows.length === 0) return;
    let cancelled = false;
    highlightRows(rows, filePath).then((result) => {
      if (!cancelled) setTokenMap(result);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, filePath]);

  if (loading) {
    return (
      <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
        Loading diff...
      </div>
    );
  }

  if (!diff.trim()) {
    return (
      <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
        No changes
      </div>
    );
  }

  return (
    <div className="max-h-[250px] overflow-auto border-t border-[var(--border)] bg-[var(--bg-primary)] py-1 font-mono text-[11px] leading-[1.6]">
      <div className="min-w-fit">
        {rows.map((row, i) => {
          if (row.kind === "hunk") {
            return (
              <div
                key={i}
                className="my-0.5 whitespace-pre bg-[var(--accent-blue)]/10 px-3 text-[10.5px] text-[var(--accent-blue-text)] first:mt-0"
              >
                {hunkLabel(row)}
              </div>
            );
          }
          if (row.kind === "note") {
            return (
              <div key={i} className="whitespace-pre px-3 text-[var(--text-muted)]">
                {row.text}
              </div>
            );
          }
          const tokens = tokenMap.get(i);
          return (
            <div key={i} className={`flex ${ROW_BG[row.type]}`}>
              <span className={GUTTER} style={gutterWidth}>
                {row.oldNo ?? ""}
              </span>
              <span className={GUTTER} style={gutterWidth}>
                {row.newNo ?? ""}
              </span>
              <span className={`whitespace-pre pl-2 pr-3 ${tokens ? "" : FALLBACK_COLOR[row.type]}`}>
                {MARKER[row.type]}
                {tokens && tokens.length > 0
                  ? tokens.map((t, j) => (
                      <span key={j} style={t.color ? { color: t.color } : undefined}>
                        {t.content}
                      </span>
                    ))
                  : row.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
