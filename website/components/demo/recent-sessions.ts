import type { AgentKind } from "./agent-script";

// A past conversation on the empty project's launcher. Its title is the
// prompt it opened with, and the reply is where it left off.
export type RecentSession = {
  key: string;
  agent: AgentKind;
  title: string;
  reply: string;
  agoMs: number;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Three a project, the most the launcher shows without room to spare.
export const RECENT_SESSIONS: Record<string, RecentSession[]> = {
  "saas-app": [
    {
      key: "saas-1",
      agent: "claude",
      title: "Add Stripe webhook retries with idempotency keys",
      reply: "Webhook handlers now dedupe on the event id and retry with backoff. Added two specs for replayed events; all green.",
      agoMs: 2 * HOUR,
    },
    {
      key: "saas-2",
      agent: "codex",
      title: "Why does the dashboard refetch on every tab focus?",
      reply: "refetchOnWindowFocus was left on in the query client. Turned it off for the dashboard queries only.",
      agoMs: 1 * DAY,
    },
    {
      key: "saas-3",
      agent: "claude",
      title: "Move invoice emails onto a Sidekiq job",
      reply: "InvoiceMailerJob now sends them outside the request; checkout no longer waits on SMTP.",
      agoMs: 3 * DAY,
    },
  ],
  "auth-service": [
    {
      key: "auth-1",
      agent: "claude",
      title: "Rotate JWT signing keys without logging everyone out",
      reply: "Tokens carry a kid header now, and verification accepts the previous key for 24 hours after a rotation.",
      agoMs: 5 * HOUR,
    },
    {
      key: "auth-2",
      agent: "claude",
      title: "Add rate limiting to /login",
      reply: "Five attempts a minute per IP and per account, with a 429 and Retry-After. Covered in login_test.go.",
      agoMs: 2 * DAY,
    },
    {
      key: "auth-3",
      agent: "codex",
      title: "Fix the flaky refresh-token test",
      reply: "The test compared expiry times to the wall clock. It uses the injected clock now and passes 200/200 runs.",
      agoMs: 6 * DAY,
    },
  ],
  "docs-site": [
    {
      key: "docs-1",
      agent: "claude",
      title: "Add a copy button to code blocks",
      reply: "Code blocks get a copy button on hover, with a check mark for a second after copying.",
      agoMs: 1 * DAY,
    },
    {
      key: "docs-2",
      agent: "codex",
      title: "Find broken links across the docs",
      reply: "Found 4 broken links, all to the old /guides paths. Pointed them at /docs and added redirects.",
      agoMs: 4 * DAY,
    },
    {
      key: "docs-3",
      agent: "claude",
      title: "Write the quickstart page",
      reply: "Quickstart covers install, first request and auth in under 60 lines, linked from the sidebar.",
      agoMs: 9 * DAY,
    },
  ],
  "ml-pipeline": [
    {
      key: "ml-1",
      agent: "codex",
      title: "Cache the feature matrix between runs",
      reply: "Features are cached as parquet keyed by the source hash; a warm run skips the 6-minute build.",
      agoMs: 3 * HOUR,
    },
    {
      key: "ml-2",
      agent: "codex",
      title: "Add early stopping to training",
      reply: "Training stops after 5 epochs without validation improvement and keeps the best checkpoint.",
      agoMs: 2 * DAY,
    },
    {
      key: "ml-3",
      agent: "claude",
      title: "Plot precision/recall per class in eval",
      reply: "eval now writes per-class precision/recall charts to reports/ next to the metrics JSON.",
      agoMs: 5 * DAY,
    },
  ],
  "mobile-app": [
    {
      key: "mobile-1",
      agent: "claude",
      title: "Add pull-to-refresh on the feed screen",
      reply: "The feed refreshes on pull and keeps its scroll position when new items arrive.",
      agoMs: 4 * HOUR,
    },
    {
      key: "mobile-2",
      agent: "codex",
      title: "Retry API calls when the app comes back online",
      reply: "Failed requests queue while offline and replay in order once NetInfo reports a connection.",
      agoMs: 1 * DAY,
    },
    {
      key: "mobile-3",
      agent: "claude",
      title: "Fix the keyboard covering the comment box",
      reply: "Wrapped the comment screen in KeyboardAvoidingView; the input stays above the keyboard on iOS and Android.",
      agoMs: 4 * DAY,
    },
  ],
};

// relativeAgo, as the app writes it: "5m ago", "2h ago", "3d ago".
export function relativeAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}
