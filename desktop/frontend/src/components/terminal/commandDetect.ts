// Whether a piece of terminal text is a shell command someone could run as it
// stands: an agent's "run `npm install`", a code block line, a tool's "Run
// `npm audit` for details". Only programs people run in a project count, so
// prose that happens to start with "make" or "find" stays plain.

const PROGRAMS = new Set([
  // JavaScript
  "npm", "npx", "pnpm", "pnpx", "yarn", "bun", "bunx", "node", "deno", "tsx", "ts-node", "tsc",
  "vite", "next", "nuxt", "astro", "expo", "eas", "turbo", "nx", "jest", "vitest", "playwright",
  "cypress", "eslint", "prettier", "biome", "corepack", "nvm", "fnm", "volta",
  // Python
  "python", "python3", "pip", "pip3", "pipx", "uv", "uvx", "poetry", "pdm", "conda", "mamba",
  "pytest", "ruff", "black", "mypy", "django-admin", "uvicorn", "gunicorn", "pyenv",
  // Ruby, PHP, JVM, .NET, Apple, mobile, Elixir
  "ruby", "gem", "bundle", "rails", "rake", "rspec", "rbenv", "php", "composer", "java", "mvn",
  "gradle", "kotlin", "dotnet", "swift", "xcodebuild", "xcrun", "xcodegen", "pod", "fastlane",
  "flutter", "dart", "mix", "elixir", "iex",
  // Rust, Go, C
  "cargo", "rustup", "go", "make", "cmake", "ninja", "bazel", "just",
  // Containers, cloud, infra
  "docker", "docker-compose", "podman", "kubectl", "helm", "minikube", "terraform", "tofu",
  "pulumi", "ansible", "ansible-playbook", "aws", "gcloud", "az", "firebase", "vercel", "netlify",
  "wrangler", "fly", "flyctl", "heroku", "supabase", "prisma",
  // Package managers
  "brew", "apt", "apt-get", "dnf", "yum", "pacman", "apk", "snap", "port", "choco", "winget", "scoop",
  "asdf", "mise", "direnv",
  // Git and agents
  "git", "gh", "glab", "lpm", "claude", "codex", "gemini", "opencode", "aider",
  // Shell
  "cd", "ls", "cat", "cp", "mv", "rm", "mkdir", "rmdir", "touch", "chmod", "chown", "ln", "find",
  "grep", "rg", "sed", "awk", "echo", "export", "source", "tail", "head", "curl", "wget", "ssh",
  "scp", "rsync", "tar", "unzip", "zip", "open", "code", "cursor", "kill", "pkill", "killall",
  "lsof", "ps", "which", "sudo", "sh", "bash", "zsh", "sqlite3", "psql", "mysql", "redis-cli",
  "mongosh",
]);

// Programs that make sense typed alone; any other needs an argument, so a
// mention like "use `git`" isn't offered as a command.
const ALONE = new Set(["make", "pytest", "jest", "vitest", "tsc", "ls", "just", "rspec"]);

// Words that turn up in prose and practically never as a bare argument. Only a
// line read as a whole is held to them: inline code already says it's code.
const PROSE = new Set([
  "the", "a", "an", "to", "and", "or", "but", "if", "then", "than", "so", "it", "its", "this",
  "that", "these", "those", "is", "are", "was", "were", "be", "been", "will", "would", "should",
  "could", "can", "may", "might", "you", "your", "we", "our", "they", "them", "their", "of",
  "with", "without", "into", "about", "when", "which", "who", "what", "why", "how", "not",
  "does", "did", "has", "have", "had", "also", "there", "here", "after", "before", "because",
]);

// `<file>`, `<branch-name>`: a placeholder to fill in, not something to run.
const PLACEHOLDER = /<[^<>\s]+>|…|(?:^|\s)\.\.\.(?:\s|$)/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const WRAPPERS = new Set(["sudo", "time", "nohup", "env", "command"]);
const SCRIPT = /^(?:\.{1,2}\/|bin\/)[\w.-]/;

function programOf(words: string[]): { program: string; at: number } | null {
  let at = 0;
  while (at < words.length && (ENV_ASSIGNMENT.test(words[at]) || WRAPPERS.has(words[at]))) at++;
  const program = words[at];
  if (!program) return null;
  if (PROGRAMS.has(program) || SCRIPT.test(program)) return { program, at };
  return null;
}

function unquoted(text: string): string {
  return text.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, " ");
}

/** The command `text` reads as, or null. `whole` holds a line with nothing to
 *  mark it as code (no colour, no backticks) to prose rules on top. */
export function readCommand(text: string, whole = false): string | null {
  const cmd = text.trim();
  if (!cmd || cmd.length > 400 || cmd.includes("\n") || PLACEHOLDER.test(cmd)) return null;
  const words = cmd.split(/\s+/);
  const found = programOf(words);
  if (!found) return null;
  if (words.length - found.at === 1 && !ALONE.has(found.program) && !SCRIPT.test(found.program)) return null;
  if (whole) {
    // A sentence or a label: "make sure the build passes.", "Then run:".
    if (/[A-Za-z0-9)'"`]\.$|:$/.test(cmd)) return null;
    const plain = unquoted(cmd).toLowerCase().split(/\s+/);
    if (plain.some((w) => PROSE.has(w.replace(/[,;!?]+$/, "")))) return null;
  }
  return cmd;
}

interface Risk {
  test: RegExp;
  reason: string;
}

const RISKS: Risk[] = [
  { test: /(?:^|[;&|(]\s*|\b(?:sudo|xargs)\s+)rm\s/, reason: "Deletes files" },
  { test: /\bgit\s+(?:clean\s+-\w*f|reset\s+--hard|checkout\s+(?:--\s+)?\.(?:\s|$)|restore\s+\.(?:\s|$))/, reason: "Discards changes" },
  { test: /\bgit\s+push\b.*\s(?:--force(?:-with-lease)?|-f)\b/, reason: "Rewrites history on the remote" },
  { test: /\bgit\s+branch\s+-D\b/, reason: "Deletes a branch" },
  { test: /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/, reason: "Runs a downloaded script" },
  { test: /\bsudo\b/, reason: "Runs as administrator" },
  { test: /\b(?:dd|mkfs(?:\.\w+)?|shred)\s|\bdiskutil\s+erase/, reason: "Erases a disk" },
  { test: /\bchmod\s+(?:-R\s+)?777\b|\bchown\s+-R\b/, reason: "Changes permissions" },
  { test: /\b(?:kill(?:all)?\s+-9|pkill)\b/, reason: "Stops processes" },
  { test: /\b(?:drop|truncate)\s+(?:table|database)\b/i, reason: "Deletes data" },
  { test: /\b(?:docker\s+(?:system\s+prune|volume\s+rm|rm\s+-f)|kubectl\s+delete|terraform\s+destroy)\b/, reason: "Deletes resources" },
  { test: /\b(?:npm|pnpm|yarn|cargo|gem)\s+publish\b/, reason: "Publishes a package" },
];

/** Why a command deserves a second look before it runs, or null. */
export function commandRisk(cmd: string): string | null {
  return RISKS.find((r) => r.test.test(cmd))?.reason ?? null;
}
