import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Claude Code and Codex are already there",
    body: "Every project's header has a Claude button and a Codex button. One click opens the agent in its own terminal tab, in the project's folder.",
  },
  {
    title: "Add any other agent with + Action",
    body: "Click + Action, give it a name, and type the command you'd run in a terminal, like cursor-agent for Cursor or omp. Create action puts it in the header next to the others.",
  },
  {
    title: "Run them side by side",
    body: "Open one agent, split the pane, and open another beside it. Each one is the real tool, with your own login, settings and model, working in the same folder.",
  },
];

export default function Lesson() {
  return (
    <LessonSection
      lesson="run-any-ai-coding-agent"
      title="Run any AI coding agent"
      description="A lesson from the lpm series: Cursor and omp added to the header in seconds, then both answering the same question side by side."
      steps={STEPS}
    />
  );
}
