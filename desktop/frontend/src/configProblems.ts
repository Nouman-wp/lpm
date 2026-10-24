// A config problem tied to a line of the file, both 1-based.
export interface ConfigProblem {
  line: number;
  col: number;
  message: string;
}

const NAMED_LINE = /^(.+?) \(line (\d+)\): (.+)$/;
const PARSER_AT = / at line (\d+),? column (\d+)/;

// The lines a config error names, one per problem: the backend's
// "services › web › port (line 5): …" and a parser's "… at line 5 column 9".
export function configProblems(error: string | null | undefined): ConfigProblem[] {
  if (!error) return [];
  const out: ConfigProblem[] = [];
  for (const raw of error.split("\n")) {
    const text = raw.trim();
    const named = NAMED_LINE.exec(text);
    if (named) {
      out.push({ line: Number(named[2]), col: 1, message: `${named[1]}: ${named[3]}` });
      continue;
    }
    const at = PARSER_AT.exec(text);
    if (at) {
      const message = (text.slice(0, at.index) + text.slice(at.index + at[0].length)).replace(/[,:]\s*$/, "");
      out.push({ line: Number(at[1]), col: Number(at[2]), message });
    }
  }
  return out;
}
