import { getTerminalThemeColors, type TerminalThemeName } from "../../terminal-themes";
import { TrafficLights } from "../ui/TrafficLights";

export function TerminalThemePreview({
  theme,
  fontSize,
  fontFamily,
  lineHeight,
}: {
  theme: TerminalThemeName;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
}) {
  const colors = getTerminalThemeColors(theme);
  const bg = colors?.bg ?? "var(--terminal-bg)";
  const fg = colors?.fg ?? "var(--terminal-fg)";
  const header = colors?.header ?? "var(--terminal-header)";
  const headerText = colors?.headerText ?? "var(--terminal-header-text)";
  const cursor = colors?.cursor ?? fg;
  const bodyFontSize = Math.min(fontSize, 11);

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-[var(--border)] font-mono shadow-sm"
      style={{ background: bg, color: fg, fontFamily }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1.5"
        style={{ background: header, color: headerText }}
      >
        <TrafficLights />
        <span className="ml-1 truncate text-[10px] leading-none">terminal</span>
      </div>
      <div
        className="px-2 py-1.5 leading-tight"
        style={{ fontSize: `${bodyFontSize}px`, lineHeight }}
      >
        <div>$ npm run dev</div>
        <div style={{ opacity: 0.7 }}>✓ ready on :3000</div>
        <div className="flex items-center">
          <span>$&nbsp;</span>
          <span
            className="demo-cursor inline-block"
            style={{ width: "0.55em", height: "1em", background: cursor }}
          />
        </div>
      </div>
    </div>
  );
}
