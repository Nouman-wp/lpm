import type * as monacoNs from "monaco-editor";
import type { ConfigProblem } from "./configProblems";

type Monaco = typeof monacoNs;

const OWNER = "lpm-config";

// Marks each problem in the editor: a squiggle with the message on hover, a
// dot in the gutter, and the message in words under its line. Returns the
// undo.
export function showProblems(
  monaco: Monaco,
  editor: monacoNs.editor.IStandaloneCodeEditor,
  problems: ConfigProblem[],
): () => void {
  const model = editor.getModel();
  if (!model) return () => {};
  const placed = problems.filter((p) => p.line >= 1 && p.line <= model.getLineCount());

  monaco.editor.setModelMarkers(
    model,
    OWNER,
    placed.map((p) => {
      const end = model.getLineMaxColumn(p.line);
      const start = p.col > 1 && p.col < end ? p.col : Math.max(1, model.getLineFirstNonWhitespaceColumn(p.line));
      return {
        severity: monaco.MarkerSeverity.Error,
        message: p.message,
        startLineNumber: p.line,
        startColumn: start,
        endLineNumber: p.line,
        endColumn: Math.max(end, start + 1),
      };
    }),
  );

  const decorations = editor.createDecorationsCollection(
    placed.map((p) => ({
      range: new monaco.Range(p.line, 1, p.line, 1),
      options: { isWholeLine: true, className: "lpm-problem-line", linesDecorationsClassName: "lpm-problem-gutter" },
    })),
  );

  const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
  let zones: string[] = [];
  editor.changeViewZones((zone) => {
    zones = placed.map((p) => {
      const node = document.createElement("div");
      node.className = "lpm-problem-zone";
      node.style.lineHeight = `${lineHeight}px`;
      node.textContent = p.message;
      node.title = p.message;
      return zone.addZone({ afterLineNumber: p.line, heightInLines: 1, domNode: node });
    });
  });

  return () => {
    if (model.isDisposed() || editor.getModel() !== model) return;
    monaco.editor.setModelMarkers(model, OWNER, []);
    decorations.clear();
    editor.changeViewZones((zone) => zones.forEach((id) => zone.removeZone(id)));
  };
}
