// A generated file is written from its own path, so every template needs the
// same few readings of it: the words in the name, and the casings they take.

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

export function parentPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** Every folder above `path`, outermost first. */
export function ancestorsOf(path: string): string[] {
  const out: string[] = [];
  let i = path.indexOf("/");
  while (i >= 0) {
    out.push(path.slice(0, i));
    i = path.indexOf("/", i + 1);
  }
  return out;
}

// Words a docs page would not sentence-case.
export const ACRONYMS = new Set([
  "api",
  "cli",
  "sso",
  "sdk",
  "sdks",
  "faq",
  "ui",
  "id",
  "url",
  "db",
  "ml",
  "os",
  "json",
  "yaml",
  "http",
  "jwt",
]);

export const cap = (w: string) =>
  ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);

export const titleCase = (words: string[]) => words.map(cap).join(" ");

export function stem(path: string): string {
  const name = basename(path);
  const dot = name.indexOf(".");
  return dot <= 0 ? name : name.slice(0, dot);
}

/** "webhooks-in-production" -> ["webhooks","in","production"] */
export function words(path: string): string[] {
  return stem(path)
    .replace(/^\d+[-_]/, "")
    .split(/[-_.]/)
    .filter(Boolean);
}

export const camel = (path: string) => {
  const [head, ...tail] = words(path);
  return head + titleCase(tail).replace(/\s/g, "");
};

export const pascal = (path: string) => titleCase(words(path)).replace(/\s/g, "");

export const snake = (path: string) => words(path).join("_");
