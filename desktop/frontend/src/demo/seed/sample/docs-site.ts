import type { AgentTask, SeedAction, SeedProject, SeedService } from "../types";
import { claudeAction } from "./agents";
import type { ChangeSpec } from "./changes";
import { BOOT_T1, BOOT_T2, DAY, MINUTE, SECOND } from "./clock";
import { defineProject } from "./define";
import { DOCS_SITE_FILES } from "./docs-site-files";

// A finished session. Its files and counts are the seeded working tree, so the
// Review tab lists exactly what it says it wrote.
const TASK_CLAUDE: AgentTask = {
  prompt: "Regenerate the API reference docs from the current routes",
  steps: [
    { kind: "thinking" },
    { kind: "tool", label: "Glob", arg: "src/pages/api/**/*.ts", result: "4 routes" },
    {
      kind: "tool",
      label: "Read",
      arg: "src/content/docs/api/authentication.mdx",
      result: "12 lines",
    },
    { kind: "tool", label: "Edit", arg: "src/content/docs/api/authentication.mdx", result: "+6 -2" },
    { kind: "tool", label: "Write", arg: "src/content/docs/api/webhooks.mdx", result: "+8" },
    { kind: "tool", label: "Write", arg: "src/components/ApiEndpoint.astro", result: "+8" },
    { kind: "tool", label: "Edit", arg: "src/content/docs/index.mdx", result: "+1" },
    { kind: "tool", label: "Edit", arg: "astro.config.mjs", result: "+1" },
    {
      kind: "text",
      text: "Regenerated the API reference from the current routes — authentication now documents header auth, webhooks gets its own page, and both render through a shared ApiEndpoint component.",
    },
    {
      kind: "text",
      text: "The dev server hot-reloaded; the updated pages are live under /docs/api.",
      style: "muted",
    },
  ],
};

const SERVICES: SeedService[] = [
  {
    name: "site",
    cmd: "pnpm dev",
    port: 4321,
    log: [
      { text: "$ pnpm dev", color: "green", at: 50 },
      { text: "", at: 150 },
      { text: " 🚀  astro  v4.8.3 started in 612ms", color: "magenta", at: 700 },
      { text: "", at: 750 },
      { text: "  ┃ Local    http://localhost:4321/", color: "cyan", at: 800 },
      { text: "  ┃ Network  use --host to expose", color: "muted", at: 850 },
      { text: "", at: 900 },
      { text: `${BOOT_T1} watching for file changes...`, color: "muted", at: 1200 },
    ],
    loop: { line: { text: `${BOOT_T2} [200] / 14ms`, color: "muted" }, everyMs: 4800 },
  },
];

const ACTIONS: SeedAction[] = [
  claudeAction(TASK_CLAUDE),
  {
    name: "build",
    label: "Build",
    emoji: "🔨",
    cmd: "pnpm build",
    display: "",
    type: "",
    durationMs: 1600,
    output: [
      { text: "$ pnpm build", color: "green", at: 50 },
      { text: " generating static routes ", color: "muted", at: 400 },
      { text: "▶ src/pages/index.astro", color: "muted", at: 700 },
      { text: "▶ src/pages/docs/[...slug].astro", color: "muted", at: 1000 },
      { text: "  └─ 42 pages", color: "muted", at: 1200 },
      { text: "✓ Complete!", color: "green", at: 1500 },
    ],
  },
  {
    name: "deploy",
    label: "Deploy",
    emoji: "🚢",
    cmd: "vercel deploy --prod",
    display: "footer",
    type: "",
    confirm: true,
    durationMs: 1800,
    output: [
      { text: "$ vercel deploy --prod", color: "green", at: 50 },
      { text: "Vercel CLI 38.0.0", color: "muted", at: 200 },
      { text: "→ building project", color: "muted", at: 500 },
      { text: "→ uploading build output (1.2 MB)", color: "muted", at: 1000 },
      { text: "→ assigning production domain", color: "muted", at: 1400 },
      { text: "✓ https://docs.example.com", color: "green", at: 1700 },
    ],
  },
];

const CHANGES: ChangeSpec[] = [
  {
    path: "src/content/docs/api/authentication.mdx",
    status: "modified",
    diff: `@@ -1,5 +1,9 @@
 ---
-title: API Keys
+title: Authentication
 ---

-Pass your key as a query parameter.
+Send your key in the \`Authorization\` header:
+
+\`\`\`bash
+curl -H "Authorization: Bearer $API_KEY" https://api.example.com/v2/me
+\`\`\``,
  },
  { path: "src/content/docs/api/webhooks.mdx", status: "added" },
  { path: "src/components/ApiEndpoint.astro", status: "added" },
  {
    path: "src/content/docs/index.mdx",
    status: "modified",
    diff: `@@ -17,2 +17,3 @@ Start here if you're new.
 - [Quickstart](/docs/quickstart)
 - [Authentication](/docs/api/authentication)
+- [Webhooks](/docs/api/webhooks)`,
  },
  {
    path: "astro.config.mjs",
    status: "modified",
    diff: `@@ -7,4 +7,5 @@ export default defineConfig({
   integrations: [
     mdx(),
+    sitemap(),
   ],
 });`,
  },
];

export const DOCS_SITE: SeedProject = defineProject({
  name: "docs-site",
  root: "~/Projects/docs-site",
  services: SERVICES,
  actions: ACTIONS,
  profiles: [{ name: "default", services: ["site"] }],
  git: {
    branch: "docs/api-v2",
    upstream: true,
    ahead: 1,
    behind: 0,
    branches: [
      { name: "docs/api-v2", ageMs: 32 * MINUTE },
      { name: "main", ageMs: DAY },
      { name: "fix/typos", ageMs: 3 * DAY },
      { name: "main", remote: "origin", ageMs: DAY },
    ],
  },
  changes: CHANGES,
  tree: DOCS_SITE_FILES,
  reply: {
    manifest: "package.json",
    readmeLines: "25 lines",
    manifestLines: "21 lines",
    sourceGlob: "src/content/**/*.mdx",
    sourceMatches: "42 matches",
    overview:
      "Astro site with MDX content in `src/content/docs`, custom components in `src/components`.",
    flows:
      "Sections: quickstart, API reference, guides, changelog. Want a deeper dive on any of them?",
    testCmd: "pnpm build",
    testResult: "42 pages in 1.6s",
    testSummary: "Build clean — all 42 pages generated, no broken links.",
    focusFile: "src/content/docs/api/authentication.mdx",
    focusLines: "16 lines",
    focusArea: "the API reference",
    hotspotDir: "src/components/",
    deployFile: "vercel.json",
    deployLines: "28 lines",
    deployCmd: "vercel deploy --prod",
    draftFile: "src/content/docs/guides/new-guide.mdx",
    wireTarget: "the sidebar nav",
  },
  session: {
    kind: "claude",
    task: TASK_CLAUDE,
    state: "done",
    ageMs: 52 * SECOND,
  },
});
