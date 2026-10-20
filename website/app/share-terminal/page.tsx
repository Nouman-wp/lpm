import type { Metadata } from "next";
import { RelatedPages } from "@/components/related-pages";
import {
  AI_AGENTS_PATH,
  FEATURES_PATH,
  LINUX_HOST_PATH,
  MOBILE_PATH,
  REVIEW_CHANGES_PATH,
  SHARE_TERMINAL_PATH,
  SSH_TERMINAL_MAC_PATH,
} from "@/lib/links";
import {
  breadcrumbJsonLd,
  jsonLdString,
  webPageJsonLd,
  youtubeLessonJsonLd,
} from "@/lib/structured-data";
import Control from "./_components/control";
import Cta from "./_components/cta";
import Faq from "./_components/faq";
import Hero from "./_components/hero";
import JoinWays from "./_components/join-ways";
import Lesson from "./_components/lesson";
import SessionVisual from "./_components/session-visual";
import UseCases from "./_components/use-cases";
import Why from "./_components/why";

const TITLE = "Share Your Terminal Live, in Any Browser";
const DESCRIPTION =
  "Share a live terminal with anyone: a shell, Claude Code or Codex. They open a link in any browser, with nothing to install, and type only when you let them.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "share terminal",
    "share terminal session",
    "share terminal over web",
    "share terminal in browser",
    "terminal sharing",
    "share terminal with teammate",
    "tmate alternative",
    "share claude code session",
    "share claude code session with others",
    "claude code pair programming",
    "share codex session",
  ],
  alternates: {
    canonical: SHARE_TERMINAL_PATH,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: SHARE_TERMINAL_PATH,
    siteName: "lpm",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const structuredData = [
  webPageJsonLd({
    title: TITLE,
    description: DESCRIPTION,
    path: SHARE_TERMINAL_PATH,
    about: [
      "terminal sharing",
      "sharing a terminal in a browser",
      "sharing a Claude Code or Codex session",
      "end-to-end encrypted terminal sharing",
    ],
  }),
  breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Share a Terminal", path: SHARE_TERMINAL_PATH },
  ]),
  youtubeLessonJsonLd("share-terminal-in-browser"),
];

export default function ShareTerminalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(structuredData) }}
      />
      <Hero />
      <SessionVisual />
      <Why />
      <Lesson />
      <JoinWays />
      <Control />
      <UseCases />
      <Faq />
      <RelatedPages
        links={[
          {
            href: SSH_TERMINAL_MAC_PATH,
            title: "The SSH terminal",
            description:
              "Add a project on any machine you can SSH into and run its terminals, services and agents there.",
          },
          {
            href: MOBILE_PATH,
            title: "Your agents on your iPhone",
            description:
              "Pair lpm Link with your computer and keep your own Claude Code sessions going from your phone.",
          },
          {
            href: LINUX_HOST_PATH,
            title: "Claude Code on a remote server",
            description:
              "Run agents on a Linux box that stays up after your laptop closes, driven from lpm on your computer.",
          },
          {
            href: REVIEW_CHANGES_PATH,
            title: "Review changes in the terminal",
            description:
              "Read every edit an agent made, undo a file, and commit the rest without leaving the app.",
          },
          {
            href: AI_AGENTS_PATH,
            title: "Best terminal for Claude Code & Codex",
            description:
              "Run Claude Code and Codex side by side on the same codebase, with your dev stack alongside.",
          },
          {
            href: FEATURES_PATH,
            title: "Everything lpm does",
            description:
              "Projects, terminals, agents, Git and other computers: the full feature list in one place.",
          },
        ]}
      />
      <Cta />
    </>
  );
}
