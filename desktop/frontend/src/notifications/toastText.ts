import { isValidElement, type ReactNode } from "react";

const LABEL_MAX = 48;
const DESCRIPTION_MAX = 160;
const TITLE_MAX = 100;

export interface ErrorText {
  title: string;
  description?: string;
  details?: string;
}

/** The words of a toast title or description, for history rows and matching
 *  repeats. Rich nodes contribute their text children. */
export function plainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return "";
}

/** Most errors arrive as one string, often "<what failed>: <raw output>". Lead
 *  with the short part and move long or multi-line output under Details. */
export function splitErrorMessage(message: string): ErrorText {
  const text = message.trim();
  const newline = text.indexOf("\n");
  if (newline !== -1) {
    const head = splitErrorMessage(text.slice(0, newline));
    const label = `${head.title}: `;
    return { ...head, details: text.startsWith(label) ? text.slice(label.length) : text };
  }

  const labelled = new RegExp(`^([^:]{1,${LABEL_MAX}}):\\s+(.+)$`).exec(text);
  if (labelled) {
    const [, title, rest] = labelled;
    return rest.length <= DESCRIPTION_MAX ? { title, description: rest } : { title, details: rest };
  }

  if (text.length <= DESCRIPTION_MAX) return { title: text };
  return { title: clip(text), details: text };
}

function clip(text: string): string {
  const sentence = text.indexOf(". ");
  if (sentence > 0 && sentence < TITLE_MAX) return text.slice(0, sentence + 1);
  return `${text.slice(0, TITLE_MAX).trimEnd()}…`;
}

/** All an error said, for Copy error: its title, reason and raw output. */
export function errorCopyText(title: string, description?: string, details?: string): string {
  return [title, description, details].filter(Boolean).join("\n");
}
