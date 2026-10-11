import { createRoot } from "react-dom/client";
import "./src/styles/globals.css";
import { JobListSections } from "./src/components/project-detail/jobs/JobListSections";
import { JobMessages } from "./src/components/project-detail/jobs/JobMessages";
import type { ScheduledJob } from "./src/hooks/useJobs";

const theme = new URLSearchParams(location.search).get("theme") ?? "dark";
document.documentElement.setAttribute("data-theme", theme);
const now = Math.floor(Date.now() / 1000);
const day = 86400;
const jobs: ScheduledJob[] = [
  { id: "news", valid: true, label: "Karucapatoxic News", emoji: "🇦🇲", enabled: true, project: "karucapatoxic", targets: ["karucapatoxic"],
    schedule: { mode: "calendar", atMinutes: 600, days: ["mon"] } as never, lastRunAt: now - 6 * day, lastResult: "found-work", unread: 12,
    lastMessage: "Most relevant Armenia real-estate news - Market activity and prices are accelerating: In Q2 2026, residential prices rose 12% year over year; Yerevan apartment prices rose 11.1%." },
  { id: "stt", valid: true, label: "New speech-to-text models", emoji: "🍎", enabled: false, project: "lpm", targets: ["lpm"],
    schedule: { mode: "interval", everySecs: 14 * 86400 }, lastRunAt: now - 7 * day, lastResult: "error", unread: 1 },
  { id: "disk", valid: true, label: "Weekly disk cleanup", emoji: "🧹", enabled: true, standalone: true, targets: [],
    schedule: { mode: "manual" }, lastRunAt: now - 7 * day, lastResult: "error", unread: 1 },
  { id: "twitter", valid: true, label: "twitter 24h summary", enabled: false, standalone: true, targets: [],
    schedule: { mode: "manual" }, lastRunAt: now - 27 * 60, lastResult: "completed",
    description: "Use computer-use tools to review the currently signed-in user's Home timeline at https://x.com/home. Summarize the posts published within the past 24 hours." },
  { id: "deps", valid: true, label: "Upgrade dependencies", emoji: "🌳", enabled: true, targets: ["a", "b"], source: "global",
    schedule: { mode: "manual" }, lastRunAt: now - 60 * day, lastResult: "completed",
    description: "Check for outdated package dependencies. Use the lpm CLI to create a duplicate of the project, then update all dependencies in the duplicate to their latest compatible versions." },
];
const noop = () => {};
const zoom = { zoom: 1, percent: 100, zoomIn: noop, zoomOut: noop, zoomReset: noop, canZoomIn: true, canZoomOut: true, surfaceRef: noop };

createRoot(document.getElementById("root")!).render(
  <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "8px 24px", width: 980 }}>
    <div id="list">
      <JobListSections
        unreadRows={jobs.filter((j) => j.unread)}
        readRows={jobs.filter((j) => !j.unread)}
        zoom={1}
        scopeLabelFor={(j) => (j.standalone ? "No project" : j.targets && j.targets.length > 1 ? `${j.targets.length} projects` : j.project ?? "")}
        rowKeyOf={(j) => j.id}
        onRunNow={noop}
        onStop={noop}
        onToggleEnabled={noop}
        onOpen={noop}
        onEdit={noop}
        onRemove={noop}
      />
    </div>
    <div id="page" style={{ height: 300, display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)" }}>
      <JobMessages
        project="lpm"
        job={jobs[1]}
        refreshKey={0}
        zoom={zoom}
        onBack={noop}
        onEdit={noop}
        onRunNow={noop}
        onStop={noop}
        onRemove={noop}
        onToggleEnabled={noop}
        onOpenCopy={noop}
        onOpenTask={noop}
        onSeenUpTo={noop}
      />
    </div>
  </div>,
);
