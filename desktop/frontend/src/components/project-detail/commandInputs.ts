// `{{key}}` input substitution into an action's shell command. Each answer is
// quoted for the spot its token sits in — bare, inside "…", or inside '…' — so
// it always stays one piece of data: `echo "hi {{name}}"` with `Ana Smith`
// runs `echo "hi "'Ana Smith'""`, and a `$(…)` answer is never expanded.
// `{{key|raw}}` splices the answer verbatim. Mirrors cmd_inputs.rs.

type Context = "bare" | "double" | "single" | "group";

function shellSafeValue(v: string): boolean {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(v);
}

function quoted(v: string, ctx: Context): string {
  if (shellSafeValue(v)) return v;
  const single = `'${v.replaceAll("'", "'\\''")}'`;
  switch (ctx) {
    case "double":
      return v ? `"${single}"` : "";
    case "single":
      return v.replaceAll("'", "'\\''");
    default:
      return single;
  }
}

const TOKEN_AT = /^\{\{([^}]*?)\}\}/;

export function substituteCommand(
  cmd: string,
  values: Record<string, string>,
): string {
  let out = "";
  const stack: Context[] = [];
  let i = 0;
  while (i < cmd.length) {
    const ctx = stack.at(-1) ?? "bare";
    const token = cmd.startsWith("{{", i) ? TOKEN_AT.exec(cmd.slice(i)) : null;
    if (token) {
      const name = token[1];
      const raw = name.endsWith("|raw");
      const key = raw ? name.slice(0, -4) : name;
      if (Object.hasOwn(values, key)) {
        out += raw ? values[key] : quoted(values[key], ctx);
        i += token[0].length;
        continue;
      }
    }
    const c = cmd[i];
    let len = 1;
    const closes =
      (ctx === "single" && c === "'") ||
      (ctx === "double" && c === '"') ||
      (ctx === "group" && c === ")");
    if (closes) {
      stack.pop();
    } else if (ctx !== "single") {
      if (c === "\\") {
        len = Math.min(2, cmd.length - i);
      } else if (c === "$" && cmd[i + 1] === "(") {
        stack.push("group");
        len = 2;
      } else if (ctx !== "double") {
        if (c === "'") stack.push("single");
        else if (c === '"') stack.push("double");
        else if (c === "(") stack.push("group");
      }
    }
    out += cmd.slice(i, i + len);
    i += len;
  }
  return out;
}
