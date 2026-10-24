"use client";

import { useClientNow } from "@/app/claude-code-codex-token-usage/_components/use-client-now";

const MINUTE_MS = 60_000;

function ago(ms: number): string {
  const minutes = Math.floor(ms / MINUTE_MS);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

// The page is rendered ahead of time, so the server writes the commit's date
// and the visitor's clock turns it into how long ago that was.
export function LastCommitAgo({ at, date }: { at: string; date: string }) {
  const now = useClientNow();
  return (
    <time dateTime={at} title={new Date(at).toUTCString()}>
      {now === null ? date : ago(Math.max(0, now - Date.parse(at)))}
    </time>
  );
}
