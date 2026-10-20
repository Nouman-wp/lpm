import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Choose how lpm works with the server",
    body: "Click + above your projects and choose Server. Install lpm there sets it up as a Linux host for many projects; Just SSH in opens one folder with nothing installed.",
  },
  {
    title: "Set up the Linux host",
    body: "Type what you'd type after ssh, like root@your-server, and click Connect. lpm installs itself there if it isn't yet, pairs over SSH, and goes straight on to adding a project.",
  },
  {
    title: "Add projects, then start agents",
    body: "Clone a repository or pick a folder on the server, as many as you like, and click Claude or Codex in the header. They keep working while your Mac sleeps.",
  },
];

export default function Lesson() {
  return (
    <LessonSection
      lesson="claude-code-codex-remote-server"
      title="Two ways to put your projects on a server"
      description="A lesson from the lpm series: set up a Linux host that holds many projects and keeps Claude Code and Codex running, or just SSH in to open one folder with nothing installed."
      steps={STEPS}
    />
  );
}
