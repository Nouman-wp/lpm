import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Say in the prompt when it should ask",
    body: "Name the calls that are yours, like which kind of release it is or whether to save a change. Any AI automation with full access can ask, with nothing to switch on.",
  },
  {
    title: "Answer when it asks",
    body: "A notification says the job is waiting for your answer, with an Answer button. Pick an option, click Yes or No, or reply in your own words. Until then, Run now waits and scheduled runs are skipped.",
  },
  {
    title: "It carries on where it stopped",
    body: "Claude Code picks up in the same conversation and finishes the job. The free lpm link app on your iPhone shows the question too.",
  },
];

export default function AskLesson() {
  return (
    <LessonSection
      id="watch-questions"
      lesson="automations-that-ask-you-first"
      title="Let it ask before it decides"
      description="A lesson from the lpm series: a release job asks which kind of release to make and checks the changelog with you, then keeps going on your answer."
      steps={STEPS}
    />
  );
}
