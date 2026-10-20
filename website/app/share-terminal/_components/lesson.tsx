import { LessonSection } from "@/components/lesson-section";

const STEPS = [
  {
    title: "Share the tab",
    body: "Right-click the terminal tab and choose Share tab. Click Create invite, then Copy, and send the link in a chat or an email.",
  },
  {
    title: "They open the link",
    body: "In a browser they click Join in browser, type their name and click Ask to join. If they use lpm, Open lpm brings it up with the invite filled in.",
  },
  {
    title: "Let them in, then let them type",
    body: "lpm asks on your computer before anyone gets in. Click Let in, and when you want them typing, switch Guests from View only to Can type.",
  },
];

export default function Lesson() {
  return (
    <LessonSection
      lesson="share-terminal-in-browser"
      title="From link to live in under a minute"
      description="A lesson from the lpm series, sharing a tab with Claude Code in it: let a teammate in from their browser, check it's really them, then hand them the keyboard."
      steps={STEPS}
    />
  );
}
