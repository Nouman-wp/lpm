import { REPO_API_URL } from "./links";

type RawIssue = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  state_reason: string | null;
  author_association: string;
  pull_request?: unknown;
  user: { type: string } | null;
};

export type Fix = {
  number: number;
  title: string;
  url: string;
  reportedAt: string;
  fixedAt: string;
};

// Reports from people outside the project, so the maker's own to-do issues
// don't count as someone being heard.
const TEAM = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export async function fetchRecentFixes(limit = 4): Promise<Fix[]> {
  try {
    const res = await fetch(
      `${REPO_API_URL}/issues?state=closed&sort=updated&direction=desc&per_page=50`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as RawIssue[];
    return raw
      .filter(
        (i): i is RawIssue & { closed_at: string } =>
          !i.pull_request &&
          i.state_reason === "completed" &&
          i.closed_at !== null &&
          i.user?.type === "User" &&
          !TEAM.has(i.author_association),
      )
      .sort((a, b) => b.closed_at.localeCompare(a.closed_at))
      .slice(0, limit)
      .map((i) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        reportedAt: i.created_at,
        fixedAt: i.closed_at,
      }));
  } catch {
    return [];
  }
}
