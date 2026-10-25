import {
  RECAP_COLORS as C,
  RECAP_FONT,
  RECAP_GLOW_DEG,
  RECAP_LAYOUT as L,
  RECAP_TAGLINE,
} from "./recapCardTheme";
import { MARK_DOT, MARK_ORIGIN, MARK_RINGS, MARK_SIZE } from "./recapMarkShape";
import { mixText, type RecapView } from "./weeklyRecapModel";

// The card drawn as an image, the way WeeklyRecapCard lays it out, at twice
// the size for sharp text on any screen.
const SCALE = 2;
const MARK_BOX = 29;
const MARK_GLYPH = 17;

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${RECAP_FONT}`;
  // Only the hero number is tracked in, as on the card.
  if ("letterSpacing" in ctx) ctx.letterSpacing = size === L.heroSize ? `${L.heroTracking * size}px` : "0px";
}

/** Where the baseline sits in a line box of `line` px, as CSS places it. */
function baseline(ctx: Ctx, line: number): number {
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  return (line - (ascent + descent)) / 2 + ascent;
}

function text(ctx: Ctx, value: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
  return ctx.measureText(value).width;
}

function fit(ctx: Ctx, value: string, width: number): string {
  if (ctx.measureText(value).width <= width) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A row with a label on the left and its value on the right. */
function pair(ctx: Ctx, y: number, label: string, value: string) {
  font(ctx, L.rowSize);
  const at = y + baseline(ctx, L.rowLine);
  const left = text(ctx, label, L.padX, at, C.soft);
  const room = L.width - 2 * L.padX - left - 12;
  text(ctx, fit(ctx, value, room), L.width - L.padX, at, C.soft, "right");
}

interface Item {
  value: string;
  size: number;
  weight: number;
  color: string;
}

/** The hero line, wrapping like the card's flex row; returns its height. */
function hero(ctx: Ctx, y: number, items: Item[], draw: boolean): number {
  const gap = 12;
  font(ctx, L.heroSize, 800);
  const big = baseline(ctx, L.heroSize);
  font(ctx, L.bodySize);
  const smallLine = L.bodySize * 1.2;
  const small = baseline(ctx, smallLine);
  let x = L.padX;
  let lineTop = y;
  let lineHeight: number = L.heroSize;
  let first = true;
  for (const item of items) {
    font(ctx, item.size, item.weight);
    const width = ctx.measureText(item.value).width;
    if (!first && x + gap + width > L.width - L.padX) {
      lineTop += lineHeight;
      lineHeight = smallLine;
      x = L.padX;
    } else if (!first) {
      x += gap;
    }
    const at = lineTop === y ? y + big : lineTop + small;
    if (draw) text(ctx, item.value, x, at, item.color);
    x += width;
    first = false;
  }
  return lineTop - y + lineHeight;
}

function tiles(ctx: Ctx, y: number, view: RecapView): number {
  const height = 2 + 2 * L.tilePadY + L.tileValueLine + L.tileLabelLine;
  const width = (L.width - 2 * L.padX - 2 * L.tileGap) / 3;
  const cells = [
    ...view.tiles.map((tile) => ({ value: tile.value, size: 24, color: C.strong, label: [[tile.label, C.muted]] })),
    { value: view.linesAdded, size: 20, color: C.green, label: [[view.linesRemoved, C.red], [" lines", C.muted]] },
  ];
  cells.forEach((cell, i) => {
    const x = L.padX + i * (width + L.tileGap);
    box(ctx, x + 0.5, y + 0.5, width - 1, height - 1, L.tileRadius);
    ctx.fillStyle = C.tile;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    const left = x + 1 + L.tilePadX;
    const top = y + 1 + L.tilePadY;
    font(ctx, cell.size, 800);
    text(ctx, cell.value, left, top + baseline(ctx, L.tileValueLine), cell.color);
    font(ctx, 13);
    let at = left;
    for (const [part, color] of cell.label) {
      at += text(ctx, part, at, top + L.tileValueLine + baseline(ctx, L.tileLabelLine), color);
    }
  });
  return height;
}

function mix(ctx: Ctx, y: number, view: RecapView): number {
  pair(ctx, y, "Agents", mixText(view.mix));
  const top = y + L.rowLine + 8;
  const room = L.width - 2 * L.padX - L.barGap * (view.mix.length - 1);
  ctx.save();
  box(ctx, L.padX, top, L.width - 2 * L.padX, L.barHeight, 5);
  ctx.clip();
  let x = L.padX;
  for (const slice of view.mix) {
    const width = Math.max(3, (room * slice.percent) / 100);
    ctx.fillStyle = slice.color;
    ctx.fillRect(x, top, width, L.barHeight);
    x += width + L.barGap;
  }
  ctx.restore();
  return L.rowLine + 8 + L.barHeight;
}

function streak(ctx: Ctx, y: number, view: RecapView): number {
  font(ctx, L.rowSize);
  text(ctx, view.streak, L.padX, y + baseline(ctx, L.rowLine), C.soft);
  const top = y + L.rowLine + 8;
  font(ctx, 12, 700);
  view.days.forEach((day, i) => {
    const x = L.padX + i * (L.day + L.dayGap);
    box(ctx, x + 0.5, top + 0.5, L.day - 1, L.day - 1, L.dayRadius);
    if (day.on) {
      ctx.fillStyle = C.green;
      ctx.fill();
    }
    ctx.strokeStyle = day.on ? C.green : C.dayOff;
    ctx.stroke();
    ctx.textBaseline = "middle";
    text(ctx, day.letter, x + L.day / 2, top + L.day / 2 + 0.5, day.on ? C.onGreen : C.muted, "center");
    ctx.textBaseline = "alphabetic";
  });
  return L.rowLine + 8 + L.day;
}

function mark(ctx: Ctx, y: number) {
  font(ctx, 14);
  const label = "lpm.cx";
  const right = L.width - L.padX;
  const textWidth = ctx.measureText(label).width;
  text(ctx, label, right, y + baseline(ctx, L.footerLine), C.muted, "right");
  const x = right - textWidth - 8 - MARK_BOX;
  const top = y + (L.footerLine - MARK_BOX) / 2;
  box(ctx, x + 0.5, top + 0.5, MARK_BOX - 1, MARK_BOX - 1, 7);
  ctx.fillStyle = C.markGround;
  ctx.fill();
  ctx.strokeStyle = C.markBorder;
  ctx.stroke();
  font(ctx, 13);
  text(ctx, fit(ctx, RECAP_TAGLINE, x - L.padX - 16), L.padX, y + baseline(ctx, L.footerLine), C.muted);
  const unit = MARK_GLYPH / MARK_SIZE;
  const ox = x + (MARK_BOX - MARK_GLYPH) / 2;
  const oy = top + (MARK_BOX - MARK_GLYPH) / 2;
  const at = (v: number) => (v - MARK_ORIGIN) * unit;
  ctx.beginPath();
  ctx.arc(ox + at(MARK_DOT.x), oy + at(MARK_DOT.y), MARK_DOT.r * unit, 0, Math.PI * 2);
  ctx.fillStyle = C.markDot;
  ctx.fill();
  ctx.strokeStyle = C.markRing;
  for (const ring of MARK_RINGS) {
    ctx.lineWidth = ring.stroke * unit;
    ctx.beginPath();
    ctx.arc(ox + at(ring.x), oy + at(ring.y), ring.r * unit, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

function heroItems(view: RecapView): Item[] {
  return [
    { value: view.hours, size: L.heroSize, weight: 800, color: C.strong },
    { value: "of agents working for you", size: L.bodySize, weight: 400, color: C.soft },
    ...(view.gain ? [{ value: view.gain, size: L.bodySize, weight: 600, color: C.green }] : []),
  ];
}

/** Lays the card out once to learn its height, then draws it. */
function paint(ctx: Ctx, view: RecapView, draw: boolean): number {
  let y = L.padTop;
  if (draw) {
    font(ctx, L.titleSize, 700);
    text(ctx, "Your week in lpm", L.padX, y + baseline(ctx, L.headerLine), C.text);
    font(ctx, L.bodySize);
    text(ctx, view.range, L.width - L.padX, y + baseline(ctx, L.headerLine), C.muted, "right");
  }
  y += L.headerLine + L.gap;
  y += hero(ctx, y, heroItems(view), draw) + L.gap;
  y += (draw ? tiles(ctx, y, view) : 2 + 2 * L.tilePadY + L.tileValueLine + L.tileLabelLine) + L.gap;
  if (view.mix.length > 0) {
    y += (draw ? mix(ctx, y, view) : L.rowLine + 8 + L.barHeight) + L.gap;
  }
  if (view.projects) {
    if (draw) pair(ctx, y, "Projects", view.projects);
    y += L.rowLine + L.gap;
  }
  y += (draw ? streak(ctx, y, view) : L.rowLine + 8 + L.day) + L.gap;
  if (draw) mark(ctx, y);
  return y + L.footerLine + L.padBottom;
}

function glow(ctx: Ctx, width: number, height: number) {
  const angle = (RECAP_GLOW_DEG * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const gradient = ctx.createLinearGradient(
    width / 2 - (dx * length) / 2,
    height / 2 - (dy * length) / 2,
    width / 2 + (dx * length) / 2,
    height / 2 + (dy * length) / 2,
  );
  gradient.addColorStop(0, C.glow);
  gradient.addColorStop(0.55, C.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawRecap(view: RecapView): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("This computer can't draw images");
  const height = Math.ceil(paint(measure, view, false));
  canvas.width = L.width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  glow(ctx, L.width, height);
  paint(ctx, view, true);
  return canvas;
}

export function recapImage(view: RecapView): Promise<Blob> {
  const canvas = drawRecap(view);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not make the image"))),
      "image/png",
    ),
  );
}
