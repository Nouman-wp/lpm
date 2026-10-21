import { formatDownloads } from "@/components/home/proof-strip";
import type { ReleaseSummary } from "@/lib/downloads";
import { getDownloadStats } from "@/lib/github-stats";
import { getReleaseSummary } from "@/lib/release-verification";

export type ReleaseInfo = {
  release: ReleaseSummary | null;
  downloads: string | null;
};

// What every download button shows: the latest release for its build menu, and
// the download count once it is big enough to read as proof.
export async function getReleaseInfo(): Promise<ReleaseInfo> {
  const [release, stats] = await Promise.all([
    getReleaseSummary(),
    getDownloadStats().catch(() => null),
  ]);
  return {
    release,
    downloads:
      stats && stats.total >= 1000 ? formatDownloads(stats.total) : null,
  };
}
