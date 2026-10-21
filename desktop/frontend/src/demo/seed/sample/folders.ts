import type { SeedFolder, SeedGit, SeedLine, SeedService } from "../types";
import { claudeAction, codexAction } from "./agents";
import { DAY, WEEK } from "./clock";
import { BOOKSHELF_FILES, CLIENT_PORTAL_FILES, DATA_WAREHOUSE_FILES } from "./folder-files";

const run = (cmd: string): SeedLine => ({ text: `$ ${cmd}`, color: "green", at: 50 });

// A fresh checkout of main, in step with origin.
const cleanGit = (ageMs: number): SeedGit => ({
  branch: "main",
  upstream: true,
  ahead: 0,
  behind: 0,
  branches: [
    { name: "main", ageMs },
    { name: "main", remote: "origin", ageMs },
  ],
  changes: [],
});

const NEXT_WEB: SeedService = {
  name: "web",
  cmd: "npm run dev",
  port: 3000,
  log: [
    run("npm run dev"),
    { text: "", at: 150 },
    { text: "  ▲ Next.js 16.3.0", color: "muted", at: 250 },
    { text: "  - Local:        http://localhost:3000", color: "muted", at: 300 },
    { text: "", at: 340 },
    { text: " ✓ Ready in 911ms", color: "cyan", at: 950 },
  ],
  loop: { line: { text: "GET / 200 in 42ms", color: "muted" }, everyMs: 3600 },
};

const RAILS: SeedService[] = [
  {
    name: "web",
    cmd: "bin/rails server -p 3000",
    port: 3000,
    log: [
      run("bin/rails server -p 3000"),
      { text: "=> Booting Puma", color: "muted", at: 400 },
      { text: "=> Rails 8.0.2 application starting in development", color: "muted", at: 650 },
      { text: "* Listening on http://127.0.0.1:3000", color: "cyan", at: 1100 },
      { text: "Use Ctrl-C to stop", color: "muted", at: 1150 },
    ],
    loop: { line: { text: 'Started GET "/books" for 127.0.0.1', color: "muted" }, everyMs: 4200 },
  },
  {
    name: "css",
    cmd: "bin/rails tailwindcss:watch",
    log: [
      run("bin/rails tailwindcss:watch"),
      { text: "≈ tailwindcss v4.1.4", color: "muted", at: 500 },
      { text: "Done in 142ms", color: "cyan", at: 800 },
    ],
  },
  {
    name: "worker",
    cmd: "bundle exec sidekiq",
    log: [
      run("bundle exec sidekiq"),
      {
        text: "Booting Sidekiq 7.3.9 with Sidekiq::RedisConnection::RedisAdapter",
        color: "muted",
        at: 600,
      },
      { text: "Starting processing, hit Ctrl-C to stop", color: "cyan", at: 1000 },
    ],
  },
];

// What lpm writes for a folder whose files name nothing it can run: one
// placeholder service to replace.
export const PLACEHOLDER: SeedService = {
  name: "dev",
  cmd: "echo 'configure me'",
  log: [run("echo 'configure me'"), { text: "configure me", at: 300 }],
};

const agents = () => [claudeAction(), codexAction()];

export const NEW_FOLDERS: SeedFolder[] = [
  {
    name: "client-portal",
    files: CLIENT_PORTAL_FILES,
    services: [NEXT_WEB],
    actions: agents(),
    git: cleanGit(2 * DAY),
    reply: {
      manifest: "package.json",
      manifestLines: "14 lines",
      readmeLines: "10 lines",
      sourceGlob: "**/*.tsx",
      sourceMatches: "3 matches",
      overview: "Next.js app router project: pages in `app/`, shared UI in `components/`.",
      flows: "Main flows: sign-in, invoices, projects. Want a deeper dive on any of them?",
      testCmd: "npm test",
      testResult: "no test script",
      testSummary: "There's no test suite yet. Want me to set up Vitest with a first test for the header?",
      focusFile: "components/header.tsx",
      focusLines: "13 lines",
      focusArea: "the header",
      hotspotDir: "app/",
      deployFile: "package.json",
      deployLines: "14 lines",
      deployCmd: "npm run build && npm start",
      draftFile: "app/invoices/page.tsx",
      wireTarget: "the header nav",
    },
  },
  {
    name: "bookshelf",
    files: BOOKSHELF_FILES,
    services: RAILS,
    actions: agents(),
    git: cleanGit(WEEK),
    reply: {
      manifest: "Gemfile",
      manifestLines: "14 lines",
      readmeLines: "10 lines",
      sourceGlob: "app/**/*.rb",
      sourceMatches: "3 matches",
      overview:
        "Rails 8 app: models and controllers in `app/`, Tailwind built by `bin/rails tailwindcss:watch`, Sidekiq for the due-date reminders.",
      flows: "Main flows: browsing the shelf, borrowing, reminders. Want a deeper dive on any of them?",
      testCmd: "bin/rails test",
      testResult: "12 runs, 31 assertions, 0 failures",
      testSummary: "All 12 tests green across the Book and Loan models and the books controller.",
      focusFile: "app/models/book.rb",
      focusLines: "11 lines",
      focusArea: "the Book model",
      hotspotDir: "app/models/",
      deployFile: "config/deploy.yml",
      deployLines: "14 lines",
      deployCmd: "bin/kamal deploy",
      draftFile: "app/jobs/due_reminder_job.rb",
      wireTarget: "the routes",
    },
  },
  {
    name: "data-warehouse",
    files: DATA_WAREHOUSE_FILES,
    services: [PLACEHOLDER],
    actions: agents(),
    git: cleanGit(3 * DAY),
    reply: {
      manifest: "dbt/dbt_project.yml",
      manifestLines: "13 lines",
      readmeLines: "10 lines",
      sourceGlob: "**/*.sql",
      sourceMatches: "5 matches",
      overview:
        "dbt project in `dbt/`: staging views over the app's raw tables, marts for revenue, and ad-hoc SQL in `queries/`.",
      flows: "Main models: orders, customers, revenue. Want a deeper dive on any of them?",
      testCmd: "dbt test --project-dir dbt",
      testResult: "8 of 8 passed",
      testSummary: "All 8 dbt tests pass: unique and not-null checks on both staging models.",
      focusFile: "dbt/models/marts/fct_revenue.sql",
      focusLines: "9 lines",
      focusArea: "the revenue mart",
      hotspotDir: "dbt/models/",
      deployFile: "dbt/dbt_project.yml",
      deployLines: "13 lines",
      deployCmd: "dbt build --project-dir dbt --target prod",
      draftFile: "dbt/models/marts/fct_retention.sql",
      wireTarget: "the marts schema",
    },
  },
];
