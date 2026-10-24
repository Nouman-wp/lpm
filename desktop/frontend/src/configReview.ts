import YAML, { type Document, type Node } from "yaml";

// The parts of a config someone writes by hand, compared before a generated
// config replaces it.
export const REVIEWED_SECTIONS = ["actions", "services", "terminals"] as const;
export type ReviewedSection = (typeof REVIEWED_SECTIONS)[number];
export type SectionKeys = Record<ReviewedSection, string[]>;

// What "Keep my actions too" puts back: the sections the UI shows as actions.
const ACTION_SECTIONS = ["actions", "terminals"] as const;

const NOUNS: Record<ReviewedSection, [string, string]> = {
  actions: ["action", "actions"],
  services: ["service", "services"],
  terminals: ["terminal", "terminals"],
};
const NAMES_SHOWN = 4;

function parse(text: string): unknown {
  try {
    return YAML.parse(text);
  } catch {
    return undefined;
  }
}

function keysOf(config: unknown, section: ReviewedSection): string[] {
  const value = config && typeof config === "object" ? (config as Record<string, unknown>)[section] : null;
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

// The entries under each section of `current` that `generated` doesn't have,
// or null when either isn't valid YAML.
export function lostEntries(current: string, generated: string): SectionKeys | null {
  const before = parse(current);
  const after = parse(generated);
  if (before === undefined || after === undefined) return null;
  const lost = {} as SectionKeys;
  for (const section of REVIEWED_SECTIONS) {
    const kept = new Set(keysOf(after, section));
    lost[section] = keysOf(before, section).filter((key) => !kept.has(key));
  }
  return lost;
}

// The keys every project's config starts with, which a generated one keeps.
const IDENTITY_KEYS = new Set(["name", "root"]);

// Whether `config` holds anything of the user's that a generated config would
// replace: more than the project's identity, or text that isn't YAML at all.
export function holdsConfig(config: string): boolean {
  const parsed = parse(config);
  if (parsed === undefined) return config.trim() !== "";
  if (!parsed || typeof parsed !== "object") return false;
  return Object.keys(parsed).some((key) => !IDENTITY_KEYS.has(key));
}

export function lostActionCount(lost: SectionKeys): number {
  return ACTION_SECTIONS.reduce((n, section) => n + lost[section].length, 0);
}

function names(keys: string[]): string {
  const shown = keys.slice(0, NAMES_SHOWN).join(", ");
  return keys.length > NAMES_SHOWN ? `${shown} and ${keys.length - NAMES_SHOWN} more` : shown;
}

function counted(section: ReviewedSection, n: number): string {
  return `${n} ${NOUNS[section][n === 1 ? 0 : 1]}`;
}

// "2 actions you wrote aren't in the new one (deploy-staging, seed)." Null
// when nothing goes missing.
export function describeLoss(lost: SectionKeys): string | null {
  const sections = REVIEWED_SECTIONS.filter((section) => lost[section].length > 0);
  if (sections.length === 0) return null;
  if (sections.length === 1) {
    const [section] = sections;
    const keys = lost[section];
    const verb = keys.length === 1 ? "isn't" : "aren't";
    return `${counted(section, keys.length)} you wrote ${verb} in the new one (${names(keys)}).`;
  }
  const parts = sections.map((section) => `${counted(section, lost[section].length)} (${names(lost[section])})`);
  const list = `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} you wrote aren't in the new one.`;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// Past this many line pairs the count stops being worth the wait.
const MAX_CELLS = 4_000_000;

function commonLines(a: string[], b: string[]): number {
  if (a.length * b.length > MAX_CELLS) return 0;
  let prev = new Uint32Array(b.length + 1);
  let row = new Uint32Array(b.length + 1);
  for (const line of a) {
    for (let j = 1; j <= b.length; j++) {
      row[j] = line === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    }
    [prev, row] = [row, prev];
  }
  return prev[b.length];
}

// Lines added and removed going from `before` to `after`, by their longest
// common run of lines.
export function lineDiffStats(before: string, after: string): { added: number; removed: number } {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  const common = commonLines(x, y);
  return { added: y.length - common, removed: x.length - common };
}

function hasAlias(node: Node): boolean {
  let found = false;
  YAML.visit(node, {
    Alias: () => {
      found = true;
      return YAML.visit.BREAK;
    },
  });
  return found;
}

// A node from `from` that can live in another document: copied with its
// comments, or rebuilt from its value when it leans on an anchor left behind.
function carried(value: unknown, from: Document, into: Document): unknown {
  if (!YAML.isNode(value)) return value;
  return hasAlias(value) ? into.createNode(value.toJS(from)) : value.clone();
}

// The generated config with the actions and terminals it left out of `current`
// put back after its own.
export function withKeptActions(generated: string, current: string): string {
  const doc = YAML.parseDocument(generated);
  const mine = YAML.parseDocument(current);
  for (const section of ACTION_SECTIONS) {
    const theirs = mine.get(section, true);
    if (!YAML.isMap(theirs)) continue;
    for (const pair of theirs.items) {
      const key = YAML.isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      if (doc.hasIn([section, key])) continue;
      let target = doc.get(section, true);
      if (!YAML.isMap(target)) {
        target = doc.createNode({});
        doc.set(section, target);
      }
      if (YAML.isMap(target)) target.set(carried(pair.key, mine, doc), carried(pair.value, mine, doc));
    }
  }
  return doc.toString();
}
