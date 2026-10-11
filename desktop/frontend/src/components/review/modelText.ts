import type * as monacoNs from "monaco-editor";

export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

// Each line with its own line break, so the parts concatenate back to `text`
// and a cut between two parts never splits a CRLF.
function lineParts(text: string): string[] {
  const parts: string[] = [];
  let from = 0;
  for (let nl = text.indexOf("\n"); nl >= 0; nl = text.indexOf("\n", from)) {
    parts.push(text.slice(from, nl + 1));
    from = nl + 1;
  }
  parts.push(text.slice(from));
  return parts;
}

// The one replacement, on whole lines, that turns `current` into `next`: the
// lines both share at the top and at the bottom are left out of it.
export function minimalEdit(current: string, next: string): TextEdit | null {
  if (current === next) return null;
  const a = lineParts(current);
  const b = lineParts(next);
  const shared = Math.min(a.length, b.length);
  let top = 0;
  while (top < shared && a[top] === b[top]) top++;
  let bottom = 0;
  while (bottom < shared - top && a[a.length - 1 - bottom] === b[b.length - 1 - bottom]) bottom++;
  let start = 0;
  for (let i = 0; i < top; i++) start += a[i].length;
  let end = current.length;
  for (let i = 0; i < bottom; i++) end -= a[a.length - 1 - i].length;
  return { start, end, text: b.slice(top, b.length - bottom).join("") };
}

// Brings a model to `text` through that edit rather than setValue. Replacing
// the whole text drops the diff editor's record of which unchanged regions are
// collapsed, so a file reloaded from disk would unfold to its full length.
export function syncModelText(model: monacoNs.editor.ITextModel, text: string): void {
  const edit = minimalEdit(model.getValue(), text);
  if (!edit) return;
  const from = model.getPositionAt(edit.start);
  const to = model.getPositionAt(edit.end);
  model.pushStackElement();
  model.pushEditOperations(
    [],
    [
      {
        range: {
          startLineNumber: from.lineNumber,
          startColumn: from.column,
          endLineNumber: to.lineNumber,
          endColumn: to.column,
        },
        text: edit.text,
      },
    ],
    () => null,
  );
  model.pushStackElement();
}
