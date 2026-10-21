// The pointer that mimes the tour: travels to each control on a slightly curved
// path, dips as it clicks, and steps aside the moment the visitor moves theirs.

const ARROW =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"><path d="M4.04 2.6a1 1 0 0 1 1.3-.33l15 7.5a1 1 0 0 1-.13 1.85l-6.3 2.1-2.1 6.3a1 1 0 0 1-1.85.13l-7.5-15a1 1 0 0 1-.42-1.55Z"/></svg>';

let el: HTMLDivElement | null = null;
let at = { x: 0, y: 0 };

function node(): HTMLDivElement {
  if (el) return el;
  el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = ARROW;
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    opacity: "0",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,.45))",
    transition: "opacity 240ms ease",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

const place = (p: { x: number; y: number }) => `translate(${p.x - 4}px, ${p.y - 3}px)`;

export function show(from = { x: window.innerWidth * 0.45, y: window.innerHeight * 0.65 }): void {
  const n = node();
  if (n.style.opacity !== "1") {
    at = from;
    n.style.transform = place(at);
  }
  n.style.opacity = "1";
}

export function hide(): void {
  if (el) el.style.opacity = "0";
}

// Travels to a point and resolves on arrival.
export async function moveTo(to: { x: number; y: number }, budgetMs = 900): Promise<void> {
  const n = node();
  show();
  const dist = Math.hypot(to.x - at.x, to.y - at.y);
  const duration = Math.min(Math.max(240 + 0.85 * dist, 320), Math.max(320, budgetMs - 140));
  const bend = Math.min(60, dist * 0.18);
  const mid = {
    x: (at.x + to.x) / 2 + ((to.y - at.y) / (dist || 1)) * bend,
    y: (at.y + to.y) / 2 - ((to.x - at.x) / (dist || 1)) * bend,
  };
  const anim = n.animate(
    [{ transform: place(at) }, { transform: place(mid), offset: 0.55 }, { transform: place(to) }],
    { duration, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" },
  );
  at = to;
  await anim.finished.catch(() => undefined);
  n.style.transform = place(to);
}

export async function tap(): Promise<void> {
  const n = node();
  const ring = document.createElement("div");
  Object.assign(ring.style, {
    position: "fixed",
    left: `${at.x - 14}px`,
    top: `${at.y - 14}px`,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid rgba(96,165,250,.9)",
    zIndex: "2147483646",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(ring);
  ring.animate([{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(1.3)", opacity: 0 }], {
    duration: 420,
    easing: "ease-out",
  }).finished.then(() => ring.remove(), () => ring.remove());
  await n
    .animate([{ transform: place(at) }, { transform: `${place(at)} scale(.86)` }, { transform: place(at) }], {
      duration: 160,
    })
    .finished.catch(() => undefined);
}
