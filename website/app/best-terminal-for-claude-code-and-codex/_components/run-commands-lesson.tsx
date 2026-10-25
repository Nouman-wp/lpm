import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Hover a command in the answer",
    body: "When Claude Code or Codex suggests a command, like npm test, hover it and a Run chip appears next to it. Click Run and its output opens in a card over the terminal, with the agent's answer still in view.",
  },
  {
    title: "Give long-running ones their own tab",
    body: "For a dev server or a watcher, choose Run in new tab and it keeps going in a terminal of its own. Or ⌘-click a command (Ctrl-click on Windows and Linux) to run it straight away.",
  },
  {
    title: "Risky commands ask first",
    body: "A command that deletes files, discards changes or runs with sudo asks once more before it runs, so a stray click never wipes anything.",
  },
];

export default function RunCommandsLesson() {
  return (
    <LessonSection
      id="watch-run-commands"
      lesson="run-agent-commands-in-one-click"
      title="Run the commands your agent suggests"
      description="A lesson from the lpm series: run npm test from Claude Code's answer, start the dev server in its own tab, ⌘-click a lint in Codex, and watch a clean reinstall ask before it deletes."
      steps={STEPS}
    />
  );
}
