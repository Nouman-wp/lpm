import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Open Automations and click New job",
    body: "In the sidebar, open More, then Automations, and click New job. Give it a name and an emoji so it's easy to spot in the list.",
  },
  {
    title: "Say what it does and where it runs",
    body: "Write an AI prompt and pick the model, or run a command or an action. Choose the projects, whether each run works on the project or a fresh copy, Full access or Read only, and which runs get reported.",
  },
  {
    title: "Pick when it runs, then try it",
    body: "Add a check so quiet days are skipped, set the schedule, from weekdays at six to a cron line, and click Create job. Run now shows the first result straight away.",
  },
];

export default function Lesson() {
  return (
    <LessonSection
      lesson="create-an-automation"
      title="Set up your first automation"
      description="A lesson from the lpm series: a weekday bug check, built option by option, then run once to read what Claude found."
      steps={STEPS}
    />
  );
}
