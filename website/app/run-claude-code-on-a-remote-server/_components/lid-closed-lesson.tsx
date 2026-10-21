import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Connect the always-on machine",
    body: "Copy an invite on the machine that stays on, then on your laptop click + above your projects, choose Another computer, and click Connect. Its projects appear in your sidebar.",
  },
  {
    title: "Start Claude Code and Codex there",
    body: "Open a project on that machine and send each agent its task. They run there, not on your laptop.",
  },
  {
    title: "Close the lid, then come back",
    body: "Disconnect and walk away. When your laptop reconnects, both agents show Done and how long they worked, with their answers waiting in the tabs.",
  },
];

export default function LidClosedLesson() {
  return (
    <LessonSection
      id="watch-lid-closed"
      lesson="keep-agents-running-on-server"
      title="Close the lid, come back to finished work"
      description="A lesson from the lpm series, recorded with a Mac mini as the always-on machine: start Claude Code and Codex there, disconnect your laptop, and both are done when it reconnects."
      steps={STEPS}
    />
  );
}
