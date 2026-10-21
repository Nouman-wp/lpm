// Finds and drives the app's own controls the way a person would: by what they
// are called on screen, through the same pointer and keyboard events.

import { wait } from "../wait";

export function visible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
}

export function nameOf(el: Element): string {
  return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

type Match = string | RegExp;

const matches = (text: string, want: Match) =>
  typeof want === "string" ? text === want : want.test(text);

export function findAll(selector: string, name?: Match, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll(selector)].filter(
    (el): el is HTMLElement => (name === undefined || matches(nameOf(el), name)) && visible(el),
  );
}

export function find(selector: string, name?: Match, root?: ParentNode): HTMLElement | null {
  return findAll(selector, name, root)[0] ?? null;
}

// The control around a label: a row whose button also carries badges, counts
// or timers is found by the text of its label alone.
export function byLabel(text: Match, root: ParentNode = document, control = "button, [role=button], [role=tab]"): HTMLElement | null {
  for (const el of root.querySelectorAll("span, div, p, button")) {
    if (el.childElementCount > 0 && el.tagName !== "BUTTON") continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim();
    if (!own || !matches(own, text)) continue;
    const hit = el.closest(control);
    if (hit && visible(hit)) return hit as HTMLElement;
  }
  return null;
}

// Waits for a control to show up and settle: the same one found twice in a
// row, so a step never acts on an element the app is about to replace.
export async function waitFor<T>(probe: () => T | null | undefined, timeoutMs = 4000): Promise<T> {
  const until = performance.now() + timeoutMs;
  let last: T | null | undefined;
  for (;;) {
    const hit = probe();
    if (hit && hit === last) return hit;
    last = hit;
    if (performance.now() > until) throw new Error("tour target never appeared");
    await wait(60);
  }
}

export function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function pointer(el: Element, type: string, init: PointerEventInit): void {
  const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, view: window, ...init }));
}

// Scrolls the app's own panes to show an element. scrollIntoView would also
// scroll the page around the iframe.
export function reveal(el: HTMLElement): void {
  for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
    const style = getComputedStyle(box);
    if (!/(auto|scroll)/.test(style.overflowY + style.overflowX)) continue;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
    if (r.left < b.left) box.scrollLeft -= b.left - r.left;
    else if (r.right > b.right) box.scrollLeft += r.right - b.right;
  }
}

export function click(el: HTMLElement, button: 0 | 2 = 0): void {
  reveal(el);
  const { x, y } = center(el);
  const init = { clientX: x, clientY: y, button, buttons: button === 2 ? 2 : 1, pointerId: 1, isPrimary: true };
  pointer(el, "pointerdown", init);
  pointer(el, "mousedown", init);
  el.focus?.({ preventScroll: true });
  pointer(el, "pointerup", { ...init, buttons: 0 });
  pointer(el, "mouseup", { ...init, buttons: 0 });
  if (button === 2) pointer(el, "contextmenu", init);
  else pointer(el, "click", init);
}

export function press(el: Element, key: string, init: KeyboardEventInit = {}): void {
  const opts = { key, code: key === "Enter" ? "Enter" : key, bubbles: true, cancelable: true, ...init };
  el.dispatchEvent(new KeyboardEvent("keydown", opts));
  el.dispatchEvent(new KeyboardEvent("keyup", opts));
}

// Types into a text field or the composer, a few characters at a time.
export async function type(el: HTMLElement, text: string, msPerChar = 28): Promise<void> {
  el.focus({ preventScroll: true });
  for (const ch of text) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
      setter?.call(el, el.value + ch);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      document.execCommand("insertText", false, ch);
    }
    if (msPerChar) await wait(msPerChar);
  }
}

