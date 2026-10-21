import { basename } from "./path-words";
import {
  astro,
  css,
  csv,
  go,
  goTest,
  ignore,
  json,
  jsTest,
  lockfile,
  mdx,
  python,
  pytest,
  ruby,
  shell,
  sql,
  ts,
  tsx,
  xml,
  yaml,
} from "./templates";

const BINARY = [
  ".parquet",
  ".ckpt",
  ".ico",
  ".png",
  ".jpg",
  ".woff",
  ".pbxproj",
  ".xcworkspacedata",
];

export function isBinary(path: string): boolean {
  return BINARY.some((ext) => path.endsWith(ext));
}

export function generateContent(path: string): string {
  const name = basename(path);
  if (isBinary(path)) return `(binary file: ${name})\n`;
  if (name.endsWith(".mdx") || name.endsWith(".md")) return mdx(path);
  if (name.endsWith("_test.go")) return goTest(path);
  if (name.endsWith(".go")) return go(path);
  if (name.includes(".test.")) return jsTest(path);
  if (name.startsWith("test_") && name.endsWith(".py")) return pytest(path);
  if (name.endsWith(".py")) return python(path);
  if (name.endsWith(".tsx")) return tsx(path);
  if (name.endsWith(".ts")) return ts(path);
  if (name.endsWith(".rb")) return ruby(path);
  if (name.endsWith(".sql")) return sql(path);
  if (name.endsWith(".astro")) return astro(path);
  if (name.endsWith(".css")) return css();
  if (name.endsWith(".csv")) return csv(path);
  if (name.endsWith(".ipynb") || name.endsWith(".json")) return json(path);
  if (name.endsWith(".plist") || name.endsWith(".xml") || name.endsWith(".svg")) return xml(path);
  if (name.endsWith(".sh") || name.endsWith(".gradle") || path.startsWith("bin/")) {
    return shell(path);
  }
  if (name.endsWith(".lock") || name.endsWith("-lock.yaml")) return lockfile(path);
  if (name.startsWith(".gitignore") || name.startsWith(".env")) return ignore();
  return yaml(path);
}

export interface SampleTree {
  // Paths whose content is filled in from the path itself.
  paths: string[];
  // The files the logs, actions and transcripts talk about, written out so
  // opening one lands on the thing the visitor just read about.
  content: Record<string, string>;
}

export function buildTree(paths: readonly string[], content: Record<string, string>) {
  const files: Record<string, string> = {};
  for (const path of paths) files[path] = generateContent(path);
  return Object.assign(files, content);
}
