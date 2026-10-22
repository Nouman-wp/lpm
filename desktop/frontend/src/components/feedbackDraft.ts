// The feedback window's one box: what kind of feedback the text reads like,
// and the issue title it turns into.

export type FeedbackKind = "bug" | "suggestion" | "question";

const BUG = [
  /\b(bug|crash(es|ed|ing)?|errors?|exceptions?|broken|fail(s|ed|ing|ure)?|freez(e|es|ing)|froze|frozen|hangs?|hanging|stuck|glitch(es|y)?|regression)\b/,
  /\b(doesn't|does not|don't|do not|didn't|did not|won't|will not|can't|cannot|isn't|is not|not|stopped) (work|working|load|loading|open|opening|start|starting|show|showing|save|saving|respond|responding)\b/,
  /\bnothing happens\b/,
];

const SUGGESTION = [
  /\b(could|would) (it|you|lpm|we|there)\b/,
  /\b(would|it'd) be (nice|great|cool|useful|helpful|handy)\b/,
  /\b(i'd|i would) (like|love)\b/,
  /\b(add|support|allow|let me)\b/,
  /\b(wish|suggest|suggestion|idea|feature request)\b/,
  /\b(an option|a setting|a button|a shortcut) (to|for)\b/,
];

const QUESTION = [
  /^(how|what|why|where|when|which|who|is there|are there|can i|do i|does|is it|should i)\b/,
  /\bhow (do|can|to|does)\b/,
  /\bis (it|there) (possible|a way)\b/,
];

const hits = (patterns: RegExp[], text: string) =>
  patterns.filter((pattern) => pattern.test(text)).length;

/** The kind the text most reads like, or null while there's nothing to read.
 *  A question mark alone counts for less than a word, so "Could it…?" stays
 *  an idea; ties go to bug, then idea. */
export function guessFeedbackKind(text: string): FeedbackKind | null {
  const normalized = text.trim().toLowerCase().replace(/[‘’]/g, "'");
  if (!normalized) return null;
  const bug = hits(BUG, normalized);
  const suggestion = hits(SUGGESTION, normalized);
  const question = hits(QUESTION, normalized) + (normalized.includes("?") ? 0.5 : 0);
  if (bug === 0 && suggestion === 0 && question === 0) return "suggestion";
  if (bug >= suggestion && bug >= question) return "bug";
  return suggestion >= question ? "suggestion" : "question";
}

const TITLE_MAX = 80;

/** The first sentence of the first line, cut at a word near TITLE_MAX. */
export function feedbackTitle(text: string): string {
  const line = text.trim().split("\n")[0].trim();
  const sentence = (line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line).replace(/\.$/, "");
  if (sentence.length <= TITLE_MAX) return sentence;
  const cut = sentence.slice(0, TITLE_MAX + 1);
  const space = cut.lastIndexOf(" ");
  const head = space > TITLE_MAX / 2 ? cut.slice(0, space) : sentence.slice(0, TITLE_MAX);
  return head.replace(/[\s,;:–-]+$/, "") + "…";
}
